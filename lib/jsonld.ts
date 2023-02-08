import { urlJoin } from "$/lib/urls.ts";

export interface Context {
  readonly urls: readonly string[];
  readonly literals: ReadonlySet<string>;
  readonly base: string | null | undefined;
  readonly vocab: string | null | undefined;
  readonly shortToLong: ReadonlyMap<string, string | null>;
  readonly longToShort: ReadonlyMap<string, string>;
  readonly types: ReadonlyMap<string, string>;
  readonly containers: ReadonlyMap<string, string>;
  iriJoin(prefix: string, suffix: string): string;
  expandName(name: string, isPrefix?: boolean): string | null | undefined;
  expandTerm(term: string): string | null | undefined;
  compactTerm(term: string): { compacted: string; rule?: string };
  toJson(
    usedLiterals?: ReadonlySet<string>,
  ): string | JsonLdContext | (string | JsonLdContext)[];
}

export class MutableContext implements Context {
  urls: string[] = [];
  literals = new Set<string>();
  base: string | null | undefined = undefined;
  vocab: string | null | undefined = undefined;
  readonly shortToLong = new Map<string, string | null>();
  readonly longToShort = new Map<string, string>();
  readonly types = new Map<string, string>();
  readonly containers = new Map<string, string>();

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
      this.base = this.expandTerm(json["@base"], json);
    }
    if (typeof json["@vocab"] === "string") {
      this.vocab = this.expandTerm(json["@vocab"], json);
    }
    for (const [k, v] of Object.entries(json)) {
      if (isKeyword(k)) {
        continue;
      }
      const resolvedKey = (isIri(k) && this.expandTerm(k)) || k,
        preId = (v && typeof v === "object")
          ? (typeof v["@id"] === "string" ? v["@id"] : k)
          : v,
        preType = (v && typeof v === "object" && typeof v["@type"] === "string")
          ? v["@type"]
          : undefined,
        container =
          (v && typeof v === "object" && typeof v["@container"] === "string")
            ? v["@container"]
            : undefined;
      if (isIri(resolvedKey) && preId && isIri(preId)) {
        throw new JsonLdError(
          `cannot map IRI ${JSON.stringify(resolvedKey)} to another IRI ${
            JSON.stringify(preId)
          } in @context`,
        );
      }
      if (container != null && !isKeyword(container)) {
        throw new JsonLdError(
          `@container must be a keyword; got ${
            JSON.stringify(container)
          } instead`,
        );
      }
      const id = preId && this.expandTerm(preId, json),
        type = (!preType || isKeyword(preType))
          ? preType
          : this.expandTerm(preType, json);
      if (id !== undefined && id !== resolvedKey) {
        this.shortToLong.set(resolvedKey, id);
        if (id) {
          if (container) {
            this.longToShort.set(`${container}:${id}`, resolvedKey);
          } else this.longToShort.set(id, resolvedKey);
        }
      }
      if (id && type) {
        this.types.set(id, type);
      }
      if (id && container) {
        this.containers.set(id, container);
      }
    }
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
    for (const [k, v] of ctx.containers) {
      this.containers.set(k, v);
    }
  }

  iriJoin(prefix: string, suffix: string): string {
    if (this.base != null && prefix.startsWith("#")) {
      prefix = `${this.base}${prefix}`;
    }
    return urlJoin(prefix, suffix);
  }

  expandName(
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
        return this.expandTerm(entry, parseContext, [name, ...history]);
      } else if (typeof entry["@id"] === "string") {
        return this.expandTerm(entry["@id"], parseContext, [
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

  expandTerm(
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
      const prefix = this.expandName(
        compactIriMatch[1],
        true,
        parseContext,
        history,
      );
      if (prefix != null) {
        return this.iriJoin(prefix, compactIriMatch[2]);
      }
    }
    return this.expandName(term, false, parseContext, history);
  }

  compactTerm(
    term: string,
    container?: string,
  ): { compacted: string; rule?: string } {
    if (container && this.longToShort.has(`${container}:${term}`)) {
      return {
        compacted: this.longToShort.get(`${container}:${term}`)!,
        rule: this.longToShort.get(`${container}:${term}`)!,
      };
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

  toJson(
    usedLiterals?: ReadonlySet<string>,
  ): string | JsonLdContext | (string | JsonLdContext)[] {
    const literals: JsonLdContext = {};
    for (const lit of this.literals) {
      if (!usedLiterals || usedLiterals.has(lit)) {
        if (isKeyword(lit)) {
          if (lit === "@base" && this.base) {
            literals[lit] = this.base;
          } else if (lit === "@vocab" && this.vocab) {
            literals[lit] = this.vocab;
          }
        } else {
          literals[lit] = this.shortToLong.get(lit)!;
        }
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
  "@container"?: string;
}

export interface JsonLdContextMeta {
  "@id"?: string;
  "@vocab"?: string;
  "@base"?: string;
  "@language"?: string;
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

export function isKeyword(term: string): term is `@${string}` {
  return term.startsWith("@");
}

export function isIri(term: string): boolean {
  return !isKeyword(term) && (term.includes(":") || term.includes("#"));
}
