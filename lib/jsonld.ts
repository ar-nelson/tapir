import { InjectableAbstract, Singleton } from "$/lib/inject.ts";
import { LongTermCache } from "$/lib/cache.ts";

export interface Context {
  readonly urls: readonly string[];
  readonly literals: ReadonlySet<string>;
  readonly base: string | null | undefined;
  readonly vocab: string | null | undefined;
  readonly shortToLong: ReadonlyMap<string, string | null>;
  readonly longToShort: ReadonlyMap<string, string>;
  readonly types: ReadonlyMap<string, string>;
  iriJoin(prefix: string, suffix: string): string;
  resolveName(name: string, isPrefix?: boolean): string | null | undefined;
  resolveTerm(term: string): string | null | undefined;
  compactTerm(term: string): { compacted: string; rule?: string };
  qualifyOnce(document: JsonLdDocument): JsonLdDocument;
  compactOnce(
    document: JsonLdDocument,
    usedLiterals?: Set<string>,
  ): JsonLdDocument;
  toJson(
    usedLiterals?: ReadonlySet<string>,
  ): string | JsonLdContext | (string | JsonLdContext)[];
}

class MutableContext implements Context {
  urls: string[] = [];
  literals = new Set<string>();
  base: string | null | undefined = undefined;
  vocab: string | null | undefined = undefined;
  readonly shortToLong = new Map<string, string | null>();
  readonly longToShort = new Map<string, string>();
  readonly types = new Map<string, string>();

  parse(
    json: JsonLdContext,
    url?: string,
    literals: readonly string[] = [],
  ): void {
    if (typeof json["@id"] === "string") {
      this.urls.push(json["@id"]);
    } else if (url != null) {
      this.urls.push(url);
      this.literals = new Set([
        ...this.literals,
        ...literals.filter((k) => k in json),
      ]);
    } else {
      this.literals = new Set([...this.literals, ...Object.keys(json)]);
    }
    if (typeof json["@base"] === "string") {
      this.base = this.resolveTerm(json["@base"], json);
    }
    if (typeof json["@vocab"] === "string") {
      this.vocab = this.resolveTerm(json["@vocab"], json);
    }
    for (const [k, v] of Object.entries(json)) {
      if (isKeyword(k)) {
        continue;
      }
      const resolvedKey = (isIri(k) && this.resolveTerm(k)) || k,
        preId = (v && typeof v === "object")
          ? (typeof v["@id"] === "string" ? v["@id"] : k)
          : v,
        preType = (v && typeof v === "object" && typeof v["@type"] === "string")
          ? v["@type"]
          : undefined;
      if (isIri(resolvedKey) && preId && isIri(preId)) {
        throw new JsonLdError(
          `cannot map IRI ${JSON.stringify(resolvedKey)} to another IRI ${
            JSON.stringify(preId)
          } in @context`,
        );
      }
      const id = preId && this.resolveTerm(preId, json),
        type = (!preType || isKeyword(preType))
          ? preType
          : this.resolveTerm(preType, json);
      if (id !== undefined && id !== resolvedKey) {
        this.shortToLong.set(resolvedKey, id);
        if (id) this.longToShort.set(id, resolvedKey);
      }
      if (id && type) {
        this.types.set(id, type);
      }
    }
    console.log(JSON.stringify(Object.entries(this.types)));
  }

  merge(ctx: Context) {
    this.urls = [...this.urls, ...ctx.urls];
    this.literals = new Set([...this.literals, ...ctx.literals]);
    this.base = this.base ?? ctx.base;
    this.vocab = this.vocab ?? ctx.vocab;
    for (const [k, v] of ctx.shortToLong) {
      this.shortToLong.set(k, v);
    }
    for (const [k, v] of ctx.longToShort) {
      this.longToShort.set(k, v);
    }
    for (const [k, v] of ctx.types) {
      this.types.set(k, v);
    }
  }

  iriJoin(prefix: string, suffix: string): string {
    if (this.base != null && prefix.startsWith("#")) {
      prefix = `${this.base}${prefix}`;
    }
    if (prefix.endsWith("/") || prefix.endsWith("#") || prefix.endsWith(":")) {
      return `${prefix}${suffix}`;
    }
    return `${prefix}/${suffix}`;
  }

  resolveName(
    name: string,
    isPrefix = false,
    parseContext?: JsonLdContext,
    history: string[] = [],
  ): string | null | undefined {
    if (isKeyword(name) || isPrefix && name === "_") {
      return name;
    } else if (this.shortToLong.has(name)) {
      return this.shortToLong.get(name);
    } else if (parseContext && Object.hasOwnProperty.call(parseContext, name)) {
      const entry: string | null | JsonLdContextEntry = parseContext[name];
      if (!entry || typeof entry === "string") {
        return this.resolveTerm(entry, parseContext, [name, ...history]);
      } else if (typeof entry["@id"] === "string") {
        return this.resolveTerm(entry["@id"], parseContext, [
          name,
          ...history,
        ]);
      }
    } else if (isIri(name)) {
      return name;
    } else if (!isPrefix && this.vocab != null) {
      return this.iriJoin(this.vocab, name);
    }
    return undefined;
  }

  resolveTerm(
    term: string | null,
    parseContext?: JsonLdContext,
    history: string[] = [],
  ): string | null | undefined {
    if (term == null || isKeyword(term)) return term;
    if (history.includes(term)) {
      throw new JsonLdError(
        `${JSON.stringify(term)} references itself recursively`,
      );
    }
    const compactIriMatch = /^([^:]+):([^:]+)$/.exec(term);
    if (compactIriMatch) {
      const prefix = this.resolveName(
        compactIriMatch[1],
        true,
        parseContext,
        history,
      );
      if (prefix != null) {
        return this.iriJoin(prefix, compactIriMatch[2]);
      }
    }
    return this.resolveName(term, false, parseContext, history);
  }

  compactTerm(term: string): { compacted: string; rule?: string } {
    if (isKeyword(term)) {
      return { compacted: term };
    }
    if (this.longToShort.has(term)) {
      return {
        compacted: this.longToShort.get(term)!,
        rule: this.longToShort.get(term)!,
      };
    }
    if (isIri(term)) {
      for (const [prefix, short] of this.longToShort) {
        if (term.startsWith(prefix)) {
          return {
            compacted: `${short}:${term.slice(prefix.length)}`,
            rule: short,
          };
        }
      }
    }
    return { compacted: term };
  }

  qualifyOnce(document: JsonLdDocument): JsonLdDocument {
    return Object.fromEntries(
      Object.entries(document).flatMap(([k, v]) => {
        if (isKeyword(k)) {
          if (k === "@type" && typeof v === "string" && !isKeyword(v)) {
            return [[k, this.resolveTerm(v)]];
          }
          return [[k, v]];
        }
        const mappedKey = this.resolveTerm(k);
        if (mappedKey === undefined) {
          throw new JsonLdError(`cannot resolve term ${JSON.stringify(k)}`);
        } else if (mappedKey === null) {
          return [];
        }
        const type = this.types.get(mappedKey);
        if (type !== "@json") {
          if (v && typeof v === "object" && "@value" in v) {
            return [[mappedKey, (v as Record<string, unknown>)["@value"]]];
          }
          return [[mappedKey, v]];
        }
        if (v && typeof v === "object" && "@value" in v) {
          return [[mappedKey, { ...v, "@type": type }]];
        }
        return [[mappedKey, { "@value": v, "@type": type }]];
      }),
    );
  }

  compactOnce(
    { "@context": _, ...document }: JsonLdDocument,
    usedLiterals?: Set<string>,
  ): JsonLdDocument {
    const compactTerm = (term: string): string => {
      const { compacted, rule } = this.compactTerm(term);
      if (usedLiterals && rule != null && this.literals.has(rule)) {
        usedLiterals.add(rule);
      }
      return compacted;
    };
    return Object.fromEntries(
      Object.entries(document).map(([k, v]) => {
        if (isKeyword(k)) {
          if (k === "@type" && typeof v === "string" && !isKeyword(v)) {
            return [k, compactTerm(v)];
          }
          return [k, v];
        }
        const mappedKey = compactTerm(k);
        if (
          v && typeof v === "object" && "@value" in v &&
          (v as Record<string, unknown>)["@type"] !== "@json"
        ) {
          return [mappedKey, (v as Record<string, unknown>)["@value"]];
        }
        return [mappedKey, v];
      }),
    );
  }

  toJson(
    usedLiterals?: ReadonlySet<string>,
  ): string | JsonLdContext | (string | JsonLdContext)[] {
    const literals: JsonLdContext = {};
    for (const lit of this.literals) {
      if (!usedLiterals || usedLiterals.has(lit)) {
        literals[lit] = this.shortToLong.get(lit)!;
      }
    }
    if (this.urls) {
      if (Object.keys(literals).length) {
        return [...this.urls, literals];
      } else {
        return this.urls.length === 1 ? this.urls[0] : this.urls;
      }
    }
    return literals;
  }
}

export interface JsonLdContextEntry {
  "@id"?: string;
  "@type"?: string;
}

export interface JsonLdContextMeta {
  "@id"?: string;
  "@vocab"?: string;
  "@base"?: string;
  "@version"?: 1 | 1.1;
}

export type JsonLdContext =
  & JsonLdContextMeta
  & Omit<Record<string, string | null | JsonLdContextEntry>, `@${string}`>;

export interface JsonLdDocument extends Record<string, unknown> {
  "@context"?: string | JsonLdContext | (string | JsonLdContext)[];
}

export class JsonLdError extends Error {
  constructor(message: string) {
    super("JSON-LD error: " + message);
  }
}

@InjectableAbstract()
export abstract class JsonLdContextFetcher {
  abstract getContext(iri: string): Promise<JsonLdContext>;
}

@Singleton(JsonLdContextFetcher)
export class HttpJsonLdContextFetcher {
  async getContext(iri: string): Promise<JsonLdContext> {
    const rsp = await fetch(iri, { headers: { accept: "application/json" } });
    const json = await rsp.json();
    if (
      json && typeof json === "object" && json["@context"] &&
      typeof json["@context"] === "object"
    ) {
      return json["@context"];
    } else {
      throw new JsonLdError(
        `The JSON data at ${
          JSON.stringify(iri)
        } does not have a '@context' object`,
      );
    }
  }
}

export function isKeyword(term: string): term is `@${string}` {
  return term.startsWith("@");
}

export function isIri(term: string): boolean {
  return !isKeyword(term) && (term.includes(":") || term.includes("#"));
}

@Singleton()
export class JsonLd {
  constructor(
    private readonly contextFetcher: JsonLdContextFetcher,
    private readonly cache: LongTermCache<Context>,
  ) {}

  async buildContext(
    ctxOrUrl: string | JsonLdContext | (string | JsonLdContext)[],
    parentContext?: Context,
  ): Promise<Context> {
    if (typeof ctxOrUrl === "string") {
      return this.cache.getOrSetAsync(ctxOrUrl, async () => {
        const json = await this.contextFetcher.getContext(ctxOrUrl);
        const mc = new MutableContext();
        if (parentContext) mc.merge(parentContext);
        mc.parse(json, ctxOrUrl);
        return mc;
      });
    } else if (Array.isArray(ctxOrUrl)) {
      let context = parentContext ?? new MutableContext();
      for (const c of ctxOrUrl) {
        context = await this.buildContext(c, context);
      }
      return context;
    } else {
      const mc = new MutableContext();
      if (parentContext) mc.merge(parentContext);
      mc.parse(ctxOrUrl, undefined, Object.keys(ctxOrUrl));
      return mc;
    }
  }

  async qualify(
    document: Record<string, unknown> | unknown[],
    parentContext?: Context,
  ): Promise<Record<string, unknown> | unknown[]> {
    if (Array.isArray(document)) {
      return Promise.all(document.map((x) => this.qualify(x, parentContext)));
    }
    let context = parentContext;
    if (document["@context"]) {
      context = await this.buildContext(
        document["@context"] as JsonLdContext,
        parentContext,
      );
    }
    if (context == null) {
      context = new MutableContext();
    }
    const expanded = context.qualifyOnce(document);
    for (const k in expanded) {
      if (isKeyword(k) && k !== "@value") {
        continue;
      }
      const v = expanded[k];
      if (v && typeof v === "object") {
        const o = v as JsonLdDocument;
        if (
          o["@value"] && typeof o["@value"] === "object" &&
          o["@type"] !== "@json"
        ) {
          if (o["@context"] !== undefined) {
            const subContext = await this.buildContext(o["@context"], context);
            o["@value"] = await this.qualify(
              o["@value"] as JsonLdDocument,
              subContext,
            );
          } else {
            o["@value"] = await this.qualify(
              o["@value"] as JsonLdDocument,
              context,
            );
          }
        } else {
          expanded[k] = await this.qualify(o, context);
        }
      }
    }
    delete expanded["@context"];
    return expanded;
  }

  private compactWithoutContext(
    document: Record<string, unknown> | unknown[],
    context: Context,
    usedLiterals: Set<string>,
  ): Record<string, unknown> | unknown[] {
    if (Array.isArray(document)) {
      return document.map((x) =>
        this.compactWithoutContext(x, context, usedLiterals)
      );
    }
    const compacted = context.compactOnce(document, usedLiterals);
    for (const k in compacted) {
      if (isKeyword(k)) {
        continue;
      }
      const v = compacted[k];
      if (v && typeof v === "object") {
        const o = v as JsonLdDocument;
        if (o["@type"] !== "@json") {
          compacted[k] = this.compactWithoutContext(o, context, usedLiterals);
        }
      }
    }
    return compacted;
  }

  compact(
    document: Record<string, unknown> | unknown[],
    context: Context,
  ): JsonLdDocument {
    const usedLiterals = new Set<string>(),
      root = this.compactWithoutContext(document, context, usedLiterals),
      contextJson = context.toJson(usedLiterals);
    return Array.isArray(root)
      ? {
        "@context": contextJson,
        "@value": root,
      }
      : { ...root, "@context": contextJson };
  }
}
