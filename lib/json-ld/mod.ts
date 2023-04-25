export * from "./context.ts";
export { fromRdf } from "./fromRdf.ts";
export * from "./IdentifierIssuer.ts";
export * from "./MessageDigest.ts";
export { serialize as rdfToString } from "./NQuads.ts";
export { toRdf } from "./toRdf.ts";
export * from "./types.ts";
export * from "./url.ts";

import { Context, ContextResolver, resolveContext } from "./context.ts";
import { fromRdf } from "./fromRdf.ts";
import { rdfQuads, toRdf } from "./toRdf.ts";
import { ContextSrc, Document, RdfEvent } from "./types.ts";
import { URDNA2015 } from "./URDNA2015.ts";

export async function expand(
  json: Document,
  resolver?: ContextResolver,
): Promise<Record<string, unknown>[]> {
  const rdf = await toRdf(json, resolver);
  return fromRdf(rdf, undefined, {
    compactKeys: false,
    compactArrays: false,
    compactValues: false,
    flatten: false,
  }) as Record<string, unknown>[];
}

export async function compact(
  json: Document,
  resolver?: ContextResolver,
  context?: Context | ContextSrc,
): Promise<Document> {
  const rdf = await toRdf(json, resolver),
    resolvedContext = (typeof (context as Context)?.lookup === "function")
      ? context as Context
      : await resolveContext(context as ContextSrc, resolver);
  return fromRdf(rdf, resolvedContext, {
    compactKeys: true,
    compactArrays: true,
    compactValues: true,
    flatten: false,
  }) as Document;
}

export async function flatten(
  json: Document,
  resolver?: ContextResolver,
  context?: Context | ContextSrc,
): Promise<{ "@graph": Record<string, unknown>[] }> {
  const rdf = await toRdf(json, resolver),
    resolvedContext = (typeof (context as Context)?.lookup === "function")
      ? context as Context
      : await resolveContext(context as ContextSrc, resolver);
  return fromRdf(rdf, resolvedContext, {
    compactKeys: true,
    compactArrays: true,
    compactValues: true,
    flatten: true,
  }) as { "@graph": Record<string, unknown>[] };
}

export function canonize(quads: Iterable<RdfEvent>): Promise<string> {
  return new URDNA2015().main(rdfQuads(quads));
}
