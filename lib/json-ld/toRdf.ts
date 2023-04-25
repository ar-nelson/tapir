import {
  RDF_FIRST,
  RDF_JSON_LITERAL,
  RDF_NIL,
  RDF_REST,
  RDF_TYPE,
  XSD_BOOLEAN,
  XSD_DOUBLE,
  XSD_INTEGER,
  XSD_STRING,
} from "./constants.ts";
import {
  BlankContext,
  Context,
  ContextResolver,
  expandTerm,
  resolveContext,
} from "./context.ts";
import { IdentifierIssuer } from "./IdentifierIssuer.ts";
import {
  Container,
  ContextTerm,
  Document,
  GraphTerm,
  isKeyword,
  Keyword,
  KeywordTerm,
  NamedNodeTerm,
  PredicateTerm,
  Quad,
  RdfEvent,
  SubjectTerm,
  TermType,
  TreeLink,
} from "./types.ts";
import { isAbsolute } from "./url.ts";

export function isTreeLink(rdf: RdfEvent): rdf is TreeLink {
  return Object.hasOwn(rdf, "child");
}

export function rdfQuads(rdf: Iterable<RdfEvent>): Quad[] {
  return [...(function* () {
    for (const e of rdf) if (!isTreeLink(e)) yield e;
  })()];
}

export async function toRdf(
  { "@context": localContext, ...src }: Document,
  resolver?: ContextResolver,
  activeContext: Context = BlankContext,
  issuer = new IdentifierIssuer("b"),
): Promise<Generator<RdfEvent>> {
  if (localContext) {
    activeContext = await resolveContext(localContext, resolver, activeContext);
  }
  return processValue(src, activeContext, issuer);
}

interface PropertySet {
  container?: Container;
  properties: Property[];
}

interface Property {
  type?: ContextTerm;
  language?: string;
  value: unknown;
}

function resolveContextType(
  type: string | undefined,
): NamedNodeTerm | KeywordTerm | undefined {
  if (!type) return undefined;
  else if (isKeyword(type)) return { termType: TermType.KEYWORD, value: type };
  else return { termType: TermType.NAMED_NODE, value: type };
}

function resolveMap(
  { "@context": localContext, ...src }: Record<string, unknown>,
  activeContext: Context,
): { keywords: Map<Keyword, unknown>; iris: Map<string, PropertySet> } {
  if (localContext !== undefined) {
    throw new Error("Non-top-level @context is not supported");
  }
  const keywords = new Map<Keyword, unknown>(),
    iris = new Map<string, PropertySet>();
  for (const [k, v] of Object.entries(src)) {
    const entry = activeContext.lookup(k);
    if (entry?.long?.termType === TermType.NAMED_NODE || isAbsolute(k)) {
      const term = entry?.long?.value ?? k;
      let properties = iris.get(term)!;
      if (!properties) iris.set(term, properties = { properties: [] });
      if (entry?.container) {
        if (properties.container) {
          if (entry.container !== "@set") {
            throw new Error(
              `Multiple @context entries set different @container values for ${
                JSON.stringify(term)
              }`,
            );
          }
        } else properties.container = entry.container;
      }
      for (
        const value of Array.isArray(v) && properties.container !== "@list"
          ? v
          : [v]
      ) {
        properties.properties.push({
          type: resolveContextType(entry?.type),
          language: entry?.language,
          value,
        });
      }
    } else if (entry?.long?.termType === TermType.KEYWORD) {
      const keyword = entry.long.value;
      if (keywords.has(keyword)) {
        throw new Error(`Duplicate use of keyword ${keyword}`);
      }
      if (entry?.type) {
        throw new Error(`Keyword alias for ${keyword} cannot have @type`);
      }
      if (entry?.language) {
        throw new Error(`Keyword alias for ${keyword} cannot have @language`);
      }
      keywords.set(keyword, v);
    }
  }
  return { keywords, iris };
}

function literalType(
  type: ContextTerm = { termType: TermType.BLANK_NODE, value: "" },
  literal: unknown,
): NamedNodeTerm {
  switch (type.termType) {
    case TermType.NAMED_NODE:
      return type;
    case TermType.KEYWORD:
      if (type.value === "@json") {
        return { termType: TermType.NAMED_NODE, value: RDF_JSON_LITERAL };
      } else if (literal == null) {
        // Ignored, this just makes null literals not throw
        return { termType: TermType.NAMED_NODE, value: "" };
      }
      throw new Error(`A literal value cannot have @type: ${type.value}`);
    default:
      switch (typeof literal) {
        case "boolean":
          return { termType: TermType.NAMED_NODE, value: XSD_BOOLEAN };
        case "number":
          return {
            termType: TermType.NAMED_NODE,
            value: Number.isSafeInteger(literal) ? XSD_INTEGER : XSD_DOUBLE,
          };
        default:
          return { termType: TermType.NAMED_NODE, value: XSD_STRING };
      }
  }
}

function* processValue(
  value: unknown,
  activeContext: Context,
  issuer: IdentifierIssuer,
  property: {
    subject?: SubjectTerm;
    predicate?: PredicateTerm;
    graph?: GraphTerm;
    type?: ContextTerm;
    language?: string;
    container?: Container;
  } = {},
): Generator<RdfEvent> {
  const graph = property.graph ??
    { termType: TermType.DEFAULT_GRAPH, value: "" };
  if (
    value == null || typeof value === "boolean" || typeof value === "number"
  ) {
    const { subject, predicate } = property;
    if (!subject || !predicate) {
      throw new Error(
        `${JSON.stringify(value)} is not allowed at the top level`,
      );
    }
    const datatype = literalType(property.type, value);
    if (value != null || datatype.value === RDF_JSON_LITERAL) {
      yield {
        subject,
        predicate,
        object: {
          termType: TermType.LITERAL,
          value: JSON.stringify(value),
          datatype,
          language: property.language,
        },
        graph,
      };
    }
  } else if (typeof value === "string") {
    const { subject, predicate } = property;
    if (!subject || !predicate) {
      throw new Error(`string is not allowed at the top level`);
    }
    const datatype =
      property.type && property.type.termType !== TermType.BLANK_NODE
        ? property.type
        : { termType: TermType.NAMED_NODE, value: XSD_STRING };
    if (datatype.termType === TermType.KEYWORD) {
      switch (datatype.value) {
        case "@id": {
          const object = expandTerm(value, activeContext);
          if (object) {
            if (object.termType === TermType.KEYWORD) {
              throw new Error(
                `Keyword ${object.value} cannot be used as a value`,
              );
            }
            yield { subject, predicate, object, graph };
          }
          return;
        }
        case "@vocab":
          throw new Error("@type: @vocab is not supported");
        case "@json":
          yield {
            subject,
            predicate,
            object: {
              termType: TermType.LITERAL,
              value: JSON.stringify(value),
              datatype: {
                termType: TermType.NAMED_NODE,
                value: RDF_JSON_LITERAL,
              },
              language: property.language,
            },
            graph,
          };
          return;
        default:
          throw new Error(`Unsupported keyword in @type: ${datatype.value}`);
      }
    } else {
      yield {
        subject,
        predicate,
        object: {
          termType: TermType.LITERAL,
          value,
          datatype: datatype as NamedNodeTerm,
          language: property.language,
        },
        graph,
      };
    }
  } else if (Array.isArray(value)) {
    if (property.container === "@list") {
      const nil = { termType: TermType.NAMED_NODE, value: RDF_NIL } as const,
        first = { termType: TermType.NAMED_NODE, value: RDF_FIRST } as const,
        rest = { termType: TermType.NAMED_NODE, value: RDF_REST } as const;
      let { subject, predicate } = property;
      for (const entry of value) {
        const node = {
          termType: TermType.BLANK_NODE,
          value: issuer.getId(),
        } as const;
        if (subject && predicate) {
          yield ({ subject, predicate, object: node, graph });
        }
        yield* processValue(entry, activeContext, issuer, {
          ...property,
          subject: node,
          predicate: first,
        });
        subject = node;
        predicate = rest;
      }
      if (subject && predicate) {
        yield ({ subject, predicate, object: nil, graph });
      }
    } else {
      for (const entry of value) {
        yield* processValue(
          entry,
          activeContext,
          issuer,
          property,
        );
      }
    }
  } else {
    const map = value as Record<string, unknown>;
    switch (property.container) {
      case "@language":
        for (const [k, v] of Object.entries(map)) {
          let language: string | undefined;
          if (k.startsWith("@")) {
            if (k === "@none") language = undefined;
            else throw new Error(`Keyword ${k} is not allowed in language map`);
          } else {
            const expanded = expandTerm(k, activeContext);
            if (
              expanded?.termType === TermType.KEYWORD &&
              expanded.value === "@none"
            ) language = undefined;
            else language = k;
          }
          yield* processValue(
            v,
            activeContext,
            issuer,
            { ...property, language },
          );
        }
        break;
      case "@type":
        for (const [k, v] of Object.entries(map)) {
          let type: ContextTerm | undefined;
          const expanded = expandTerm(k, activeContext);
          switch (expanded?.termType) {
            case TermType.KEYWORD:
              if (expanded.value === "@none") type = undefined;
              else throw new Error(`Keyword ${k} is not allowed in type map`);
              break;
            default:
              type = expanded ?? { termType: TermType.NAMED_NODE, value: k };
              break;
          }
          yield* processValue(
            v,
            activeContext,
            issuer,
            { ...property, type },
          );
        }
        break;
      default: {
        const { keywords, iris } = resolveMap(map, activeContext);
        yield* processMap(
          keywords,
          iris,
          activeContext,
          issuer,
          property,
        );
      }
    }
  }
}

function* processMap(
  keywords: Map<Keyword, unknown>,
  iris: Map<string, PropertySet>,
  activeContext: Context,
  issuer: IdentifierIssuer,
  property: {
    subject?: SubjectTerm;
    predicate?: PredicateTerm;
    graph?: GraphTerm;
    type?: ContextTerm;
    language?: string;
    container?: Container;
  } = {},
): Generator<RdfEvent> {
  const graph = property.graph ??
      { termType: TermType.DEFAULT_GRAPH, value: "" },
    typeProp = keywords.get("@type");
  if (typeProp != null && typeof typeProp !== "string") {
    throw new Error("@type must be a string");
  }
  const type = typeProp !== undefined
    ? expandTerm(typeProp as string, activeContext)
    : property.type;
  let container = property.container,
    nodeType: Keyword | undefined = undefined;
  for (const kw of keywords.keys()) {
    switch (kw) {
      case "@set":
      case "@list":
      case "@graph":
      case "@value":
        if (nodeType && nodeType !== kw) {
          throw new Error(`Map cannot contain both ${nodeType} and ${kw}`);
        }
        nodeType = kw;
        break;
    }
  }
  if (nodeType) {
    if (iris.size) {
      throw new Error(
        `Map with ${nodeType} cannot contain non-keyword properties`,
      );
    }
    if (container && container !== nodeType) {
      throw new Error(
        `${nodeType} node is not compatible with @container: ${container}`,
      );
    }
    if (nodeType !== "@value") container = nodeType;
  }

  switch (nodeType) {
    case "@value": {
      const { subject, predicate } = property;
      if (!subject || !predicate) {
        throw new Error("@value is not allowed at the top level");
      }
      const languageProp = keywords.get("@language");
      if (languageProp != null && typeof languageProp !== "string") {
        throw new Error("@language must be a string");
      }
      const value = keywords.get("@value"),
        language =
          (languageProp === undefined ? property.language : languageProp) ??
            undefined,
        datatype = literalType(type ?? undefined, value);
      if (value != null || datatype.value === RDF_JSON_LITERAL) {
        yield {
          subject,
          predicate,
          object: {
            termType: TermType.LITERAL,
            value:
              typeof value === "string" && datatype.value !== RDF_JSON_LITERAL
                ? value
                : JSON.stringify(value),
            datatype,
            language,
          },
          graph,
        };
      }
      return;
    }
    case "@set":
    case "@list": {
      const value = keywords.get(nodeType);
      yield* processValue(
        Array.isArray(value) ? value : [value],
        activeContext,
        issuer,
        { ...property, container },
      );
      return;
    }
  }

  const idProp = keywords.get("@id");
  if (idProp != null && typeof idProp !== "string") {
    throw new Error("@id must be a string");
  }
  const id = idProp != null
    ? expandTerm(idProp as string, activeContext)
    : { termType: TermType.BLANK_NODE, value: issuer.getId() } as const;
  if (id == null) return;
  if (id.termType === TermType.KEYWORD) {
    throw new Error("@id cannot be a keyword");
  }

  {
    const { subject, predicate } = property;
    yield { parent: subject, child: id };
    if (subject && predicate) yield { subject, predicate, object: id, graph };
  }

  if (nodeType === "@graph") {
    const graphEntries = keywords.get("@graph");
    if (!Array.isArray(graphEntries)) {
      throw new Error("@graph must be an array");
    }
    for (const entry of graphEntries) {
      if (!entry || Array.isArray(entry) || typeof entry !== "object") {
        throw new Error("@graph entries must be objects");
      }
      const { keywords, iris } = resolveMap(entry, activeContext);
      yield* processMap(keywords, iris, activeContext, issuer, { graph: id });
    }
    return;
  }

  if (type && type.termType !== TermType.KEYWORD) {
    yield {
      subject: id,
      predicate: { termType: TermType.NAMED_NODE, value: RDF_TYPE },
      object: type,
      graph,
    };
  }
  for (const [k, { container, properties }] of iris) {
    const predicate = { termType: TermType.NAMED_NODE, value: k } as const;
    for (const { type, language, value } of properties) {
      yield* processValue(value, activeContext, issuer, {
        subject: id,
        predicate,
        type,
        language,
        container,
        graph,
      });
    }
  }
}
