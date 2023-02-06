import { urlJoin } from "$/lib/urls.ts";

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

export class MutableContext implements Context {
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
    return urlJoin(prefix, suffix);
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

export function isKeyword(term: string): term is `@${string}` {
  return term.startsWith("@");
}

export function isIri(term: string): boolean {
  return !isKeyword(term) && (term.includes(":") || term.includes("#"));
}
