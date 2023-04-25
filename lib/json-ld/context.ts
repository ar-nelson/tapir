import {
  Container,
  ContextDefinition,
  ContextSrc,
  ContextTerm,
  isKeyword,
  TermDefinition,
  TermDefinitions,
  TermType,
} from "./types.ts";
import { isAbsolute, removeBase } from "./url.ts";

export interface ContextEntry {
  short: string;
  long: ContextTerm | null;
  type?: string;
  language?: string;
  container?: Container;
}

export interface Context {
  lookup(term: string): ContextEntry | undefined;
  reverseLookup(term: ContextTerm): ContextEntry[];
  readonly vocab?: string;
  readonly base?: string;
  readonly prefixes: Map<string, string>;
  toJson(): ContextSrc;
}

export function expandTerm(term: string, context: Context): ContextTerm | null;
export function expandTerm(
  term: string,
  context: Context,
  reject: (k: string) => boolean,
): ContextTerm | null | false;
export function expandTerm(
  term: string,
  context: Context,
  reject = (_k: string) => false,
): ContextTerm | null | false {
  if (isKeyword(term)) return { termType: TermType.KEYWORD, value: term };
  const colon = term.indexOf(":");
  if (colon > 0) {
    const prefix = term.slice(0, colon), suffix = term.slice(colon + 1);
    if (prefix === "_") {
      return { termType: TermType.BLANK_NODE, value: suffix, preserve: true };
    } else if (suffix.startsWith("//")) {
      return { termType: TermType.NAMED_NODE, value: term };
    } else {
      if (reject(prefix)) return false;
      const longPrefix = context.prefixes.get(prefix);
      if (longPrefix) {
        return {
          termType: TermType.NAMED_NODE,
          value: longPrefix + suffix,
        } as const;
      }
    }
  }
  if (reject(term)) return false;
  const existing = context.lookup(term);
  if (existing) return existing.long;
  else if (!isAbsolute(term)) {
    if (context.vocab) {
      return {
        termType: context.vocab === "_:"
          ? TermType.BLANK_NODE
          : TermType.NAMED_NODE,
        value: context.vocab + term,
      };
    } else if (context.base) {
      return {
        termType: TermType.NAMED_NODE,
        value: context.base + term,
      };
    }
  }
  return null;
}

export function compactTerm(term: ContextTerm, context: Context): string {
  // Specific match
  const existing = context.reverseLookup(term).find((e) =>
    !e.type && !e.language && !e.container
  );
  if (existing) return existing.short;

  // Vocab/Base
  switch (term.termType) {
    case TermType.NAMED_NODE:
      if (context.vocab && term.value.startsWith(context.vocab)) {
        return removeBase(context.vocab, term.value);
      } else if (context.base && term.value.startsWith(context.base)) {
        return removeBase(context.base, term.value);
      }
      break;
    case TermType.BLANK_NODE:
      return context.vocab === "_:" ? term.value : `_:${term.value}`;
    case TermType.KEYWORD:
      return term.value;
  }

  // Prefix
  let compacted: string = term.value;
  for (const [short, long] of context.prefixes) {
    if (term.value.startsWith(long)) {
      const prefixed = `${short}:${term.value.slice(long.length)}`;
      if (compareShortestLeast(prefixed, compacted) < 0) {
        compacted = prefixed;
      }
    }
  }

  return compacted;
}

export const BlankContext: Context = {
  lookup() {
    return undefined;
  },
  reverseLookup() {
    return [];
  },
  toJson() {
    return [];
  },
  prefixes: new Map<string, string>(),
};

function joinUrls(
  base: string | undefined,
  suffix: string | undefined | null,
): string | undefined {
  if (suffix === null) return undefined;
  if (base && suffix && isAbsolute(base) && !isAbsolute(suffix)) {
    return base + suffix;
  }
  return suffix || base;
}

export class LiteralContext implements Context {
  readonly #fromShort = new Map<string, ContextEntry>();
  readonly #fromLong = new Map<string, ContextEntry[]>();
  readonly vocab?: string;
  readonly base?: string;
  readonly prefixes: Map<string, string>;

  constructor(
    private readonly src: ContextDefinition,
    private readonly parent: Context = BlankContext,
    private readonly url?: string,
  ) {
    this.vocab = joinUrls(parent?.vocab, src["@vocab"]);
    this.base = joinUrls(parent?.base, src["@base"]);
    this.prefixes = new Map(parent?.prefixes ?? []);
    let terms = Object.entries(src as TermDefinitions).filter(([k]) =>
        !k.startsWith("@")
      ),
      delayed: [string, string | TermDefinition][] = [];
    while (terms.length) {
      for (const [term, defn] of terms) {
        let entry: ContextEntry;
        if (defn == null) {
          entry = { short: term, long: null };
        } else if (typeof defn === "string") {
          const resolved = expandTerm(
            defn,
            this,
            (it) => terms.some(([k]) => k === it),
          );
          if (resolved === false) {
            delayed.push([term, defn]);
            continue;
          }
          entry = {
            ...this.lookup(defn) ?? {},
            short: term,
            long: resolved,
          };
          if (
            resolved?.termType == TermType.NAMED_NODE &&
            (resolved.value.endsWith("#") || resolved.value.endsWith("/"))
          ) {
            this.prefixes.set(term, resolved.value);
          }
        } else {
          for (
            const k of [
              "@context",
              "@propagate",
              "@protected",
              "@nest",
              "@reverse",
            ] as const
          ) {
            if (defn[k] != null) {
              throw new Error(
                `${k} is not supported in an expanded term definition`,
              );
            }
          }
          let long: ContextTerm | null;
          if (defn["@id"] !== undefined) {
            const resolved = defn["@id"] == null
              ? null
              : expandTerm(defn["@id"] as string, this, (it) =>
                terms.some(([k]) =>
                  k === it
                ));
            if (resolved === false) {
              delayed.push([term, defn]);
              continue;
            }
            long = resolved;
          } else if (isAbsolute(term)) {
            long = { termType: TermType.NAMED_NODE, value: term };
          } else if (this.vocab) {
            if (this.vocab === "_:") {
              long = {
                termType: TermType.BLANK_NODE,
                value: this.vocab + term,
                preserve: true,
              };
            } else {
              long = {
                termType: TermType.NAMED_NODE,
                value: this.vocab + term,
              };
            }
          } else {
            throw new Error(
              "Expanded term definition must have an @id or have an absolute IRI key",
            );
          }
          const defnType = defn["@type"];
          let type: string | undefined = undefined;
          if (defnType != null) {
            const resolved = expandTerm(
              defnType,
              this,
              (it) => terms.some(([k]) => k === it),
            );
            if (resolved === false) {
              delayed.push([term, defn]);
              continue;
            }
            type = resolved?.termType === TermType.NAMED_NODE
              ? resolved.value
              : defnType;
          }
          let container = defn["@container"];
          if (Array.isArray(container)) {
            let c: Container = "@set";
            for (const e of container) {
              if (e !== "@set" && c !== "@set" && e !== c) {
                throw new Error(`@container cannot contain both ${c} and ${e}`);
              }
              c = e;
            }
            container = c;
          }
          entry = {
            ...(long?.termType === TermType.NAMED_NODE &&
              this.lookup(long.value)) ?? {},
            short: term,
            long,
            ...(type ? { type } : {}),
            ...(defn["@language"] ? { language: defn["@language"]! } : {}),
            ...(typeof container === "string" ? { container } : {}),
          };
          if (long?.termType == TermType.NAMED_NODE && defn["@prefix"]) {
            this.prefixes.set(entry.short, long.value);
          }
        }
        this.#fromShort.set(entry.short, entry);
        if (
          entry.long?.termType === TermType.NAMED_NODE ||
          entry.long?.termType === TermType.KEYWORD
        ) {
          const entries = this.#fromLong.get(entry.long.value) ?? [];
          if (!entries.length) this.#fromLong.set(entry.long.value, entries);
          insertSorted(
            entries,
            entry,
            (a, b) => compareShortestLeast(a.short, b.short),
          );
        }
      }
      if (delayed.length >= terms.length) {
        throw new Error(
          `Recursive term definitions in context: ${JSON.stringify(delayed)}`,
        );
      }
      terms = delayed;
      delayed = [];
    }
  }

  lookup(term: string): ContextEntry | undefined {
    return this.#fromShort.get(term) ?? this.parent.lookup(term);
  }

  reverseLookup(term: ContextTerm): ContextEntry[] {
    if (term.termType === TermType.BLANK_NODE) return [];
    return [
      ...this.#fromLong.get(term.value) ?? [],
      ...this.parent?.reverseLookup(term) ?? [],
    ];
  }

  toJson(): ContextSrc {
    const parentJson = this.parent.toJson(),
      arr = [
        ...Array.isArray(parentJson) ? parentJson : [parentJson],
        this.url ?? this.src,
      ];
    return arr.length === 1 ? arr[0] : arr;
  }
}

export class ChainContext implements Context {
  readonly vocab?: string;
  readonly base?: string;
  readonly prefixes: Map<string, string>;

  constructor(
    private readonly first: Context,
    private readonly second: Context,
    private readonly url?: string,
  ) {
    this.vocab = first.vocab || second.vocab;
    this.base = first.base || second.base;
    this.prefixes = new Map([...this.first.prefixes, ...this.second.prefixes]);
  }

  lookup(term: string) {
    return this.first.lookup(term) ?? this.second.lookup(term);
  }

  reverseLookup(term: ContextTerm) {
    return [
      ...this.first.reverseLookup(term),
      ...this.second.reverseLookup(term),
    ];
  }

  toJson(): ContextSrc {
    if (this.url) return this.url;
    const a = this.second.toJson(),
      b = this.first.toJson(),
      arr = [
        ...Array.isArray(a) ? a : [a],
        ...Array.isArray(b) ? b : [b],
      ];
    return arr.length === 1 ? arr[0] : arr;
  }
}

export const compareShortestLeast = (a: string, b: string) => {
  if (a.length < b.length) return -1;
  if (b.length < a.length) return 1;
  if (a === b) return 0;
  return (a < b) ? -1 : 1;
};

function binarySearch<T>(
  arr: T[],
  el: T,
  compare: (a: T, b: T) => number,
): number {
  let m = 0, n = arr.length - 1;
  while (m <= n) {
    const k = (n + m) >> 1, cmp = compare(el, arr[k]);
    if (cmp > 0) m = k + 1;
    else if (cmp < 0) n = k - 1;
    else return k;
  }
  return ~m;
}

function insertSorted<T>(arr: T[], el: T, compare: (a: T, b: T) => number) {
  const i = binarySearch(arr, el, compare);
  if (i < 0) arr.splice(~i, 0, el);
}

export interface ContextResolver {
  resolve(
    url: string,
    activeContext?: Context,
    history?: string[],
  ): Promise<Context>;
}

export class FixedContextResolver implements ContextResolver {
  #contexts: Map<string, Promise<Context>>;

  constructor(
    contexts: Record<string, ContextSrc>,
    private readonly next?: ContextResolver,
  ) {
    this.#contexts = new Map(
      Object.entries(contexts).map((
        [k, v],
      ) => [k, resolveContext(v, next, undefined, [], k)]),
    );
  }

  async resolve(url: string, activeContext?: Context): Promise<Context> {
    const defined = this.#contexts.get(url);
    return defined
      ? (activeContext && activeContext !== BlankContext
        ? new ChainContext(await defined, activeContext)
        : defined)
      : (this.next ? this.next.resolve(url, activeContext) : Promise.reject(
        new Error(
          `Only predefined context URLs are supported, and the context URL ${
            JSON.stringify(url)
          } does not have a known context definition`,
        ),
      ));
  }
}

export function resolveContext(
  src: ContextSrc | null,
  resolver?: ContextResolver,
  activeContext: Context = BlankContext,
  history: string[] = [],
  url?: string,
): Promise<Context> {
  if (src == null) return Promise.resolve(BlankContext);
  else if (Array.isArray(src)) {
    return src.reduce(
      (ctx, src) =>
        ctx.then((c) => resolveContext(src, resolver, c, history, url)),
      Promise.resolve(activeContext),
    );
  } else if (typeof src === "string") {
    if (!resolver) {
      throw new Error(
        `Cannot load context URL ${
          JSON.stringify(src)
        }: no context resolver defined`,
      );
    }
    if (history.includes(src)) {
      throw new Error(
        `Circular URL reference in JSON-LD context: ${JSON.stringify(src)}`,
      );
    }
    return resolver.resolve(src, activeContext, [...history, src]);
  } else return Promise.resolve(new LiteralContext(src, activeContext, url));
}
