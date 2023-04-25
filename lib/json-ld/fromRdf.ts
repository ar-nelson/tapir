import {
  RDF_FIRST,
  RDF_JSON_LITERAL,
  RDF_NIL,
  RDF_REST,
  RDF_TYPE,
  XSD_BOOLEAN,
  XSD_DOUBLE,
  XSD_FLOAT,
  XSD_INTEGER,
  XSD_NON_NEGATIVE_INTEGER,
  XSD_STRING,
} from "./constants.ts";
import {
  BlankContext,
  compactTerm,
  compareShortestLeast,
  Context,
  ContextEntry,
} from "./context.ts";
import { isTreeLink } from "./toRdf.ts";
import {
  ContextTerm,
  Document,
  isKeyword,
  LiteralTerm,
  ObjectTerm,
  RdfEvent,
  TermType,
} from "./types.ts";

export interface FromRDFOptions {
  compactKeys?: boolean;
  compactValues?: boolean;
  compactArrays?: boolean;
  flatten?: boolean;
}

export function fromRdf(
  events: Iterable<RdfEvent>,
  activeContext: Context = BlankContext,
  {
    compactKeys = activeContext !== BlankContext,
    compactValues = activeContext !== BlankContext,
    compactArrays = activeContext !== BlankContext,
    flatten = false,
  }: FromRDFOptions = {},
): Document | Record<string, unknown>[] {
  const subjects = new Map<string, Map<string, ObjectTerm[]>>(),
    objects = new Set<string>(),
    parents = new Map<string, string>(),
    rootIds: string[] = [];

  for (const event of events) {
    if (isTreeLink(event)) {
      if (event.parent) {
        parents.set(termToString(event.child), termToString(event.parent));
      } else rootIds.push(termToString(event.child));
      continue;
    }
    const { subject, predicate, object, graph } = event;
    if (graph.termType !== TermType.DEFAULT_GRAPH) {
      throw new Error("Serializing multiple graphs is not yet supported");
    }
    const subjectIri = termToString(subject);
    let subjectMap = subjects.get(subjectIri);
    if (!subjectMap) {
      subjectMap = new Map();
      if (subject.termType !== TermType.BLANK_NODE) {
        subjectMap.set("@id", [subject]);
      }
      subjects.set(subjectIri, subjectMap);
    }

    const predicateKey = predicate.value === RDF_TYPE
      ? "@type"
      : predicate.value;
    let predicateSet = subjectMap.get(predicateKey);
    if (!predicateSet) subjectMap.set(predicateKey, predicateSet = []);
    predicateSet.push(object);
    if (object.termType !== TermType.LITERAL) objects.add(termToString(object));
  }

  const contextJson = activeContext.toJson(),
    contextPrefix = Array.isArray(contextJson) && !contextJson.length
      ? {}
      : { "@context": contextJson },
    roots = rootIds.length
      ? rootIds.map((i) => [i, subjects.get(i)!] as const)
      : [...subjects].filter(([k]) => !objects.has(k)),
    used = new Set<string>(rootIds);

  function resolveMap(
    map: Map<string, ObjectTerm[]>,
    id: string | undefined,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [predicate, objects] of map) {
      if (isKeyword(predicate)) {
        if (objects.length !== 1) {
          throw new Error(`More than one entry for ${predicate}`);
        }
        const object = objects[0];
        if (object.termType === TermType.LITERAL) {
          throw new Error(`${predicate} cannot be a literal`);
        }
        const key = compactKeys
            ? compactTerm(
              { termType: TermType.KEYWORD, value: predicate },
              activeContext,
            )
            : predicate,
          value = compactValues
            ? compactTerm(object, activeContext)
            : termToString(object);
        result[key] = predicate === "@id" || compactArrays ? value : [value];
      } else {
        for (const object of objects) {
          const { key, subkey, value } = resolveTerm(object, predicate, id);
          if (Object.hasOwn(result, key)) {
            if (typeof subkey === "string") {
              const submap = result[key] as Record<string, unknown>;
              if (Object.hasOwn(submap, subkey)) {
                const existing = submap[subkey];
                submap[subkey] = Array.isArray(existing)
                  ? [...existing, value]
                  : [existing, value];
              } else submap[subkey] = value;
            } else {
              const existing = result[key];
              result[key] = Array.isArray(existing)
                ? [...existing, value]
                : [existing, value];
            }
          } else {
            switch (typeof subkey) {
              case "string":
                result[key] = { [subkey]: value };
                break;
              case "number":
                result[key] = [value];
                break;
              default:
                result[key] = compactArrays ? value : [value];
            }
          }
        }
      }
    }
    return result;
  }

  function resolveList(term: ObjectTerm): unknown[] | null {
    if (term.termType === TermType.NAMED_NODE && term.value === RDF_NIL) {
      return [];
    }
    if (term.termType === TermType.LITERAL) return null;
    const id = termToString(term), subjectMap = subjects.get(id);
    if (
      !subjectMap || subjectMap.size !== 2 ||
      subjectMap.get(RDF_FIRST)?.length !== 1 ||
      subjectMap.get(RDF_REST)?.length !== 1
    ) return null;
    const first = subjectMap.get(RDF_FIRST)![0],
      rest = subjectMap.get(RDF_REST)![0],
      restList = resolveList(rest);
    if (restList == null) return null;
    return [resolveTerm(first, RDF_FIRST, id).value, ...restList];
  }

  function resolveTerm(
    term: ObjectTerm,
    predicate: string,
    parent: string | undefined,
  ): { key: string; subkey?: string | 0; value: unknown } {
    const entries = compactKeys
        ? activeContext.reverseLookup({
          termType: TermType.NAMED_NODE,
          value: predicate,
        })
        : [],
      getKey = (e?: ContextEntry) =>
        e?.short ??
          (compactKeys
            ? compactTerm(
              { termType: TermType.NAMED_NODE, value: predicate },
              activeContext,
            )
            : predicate);
    if (term.termType === TermType.LITERAL) {
      const matchingEntry = entries.filter((e) =>
        e.container !== "@list" &&
        (!e.type || (e.type ?? XSD_STRING) === term.datatype.value) &&
        (!e.language || e.language === term.datatype.value)
      ).map((e) => ({
        ...e,
        rank: ((e.type ?? XSD_STRING) === term.datatype.value ? 10 : 0) +
          (e.language === term.language
            ? 10
            : (term.language && e.container === "@language" ? 1 : 0)),
      })).sort((a, b) =>
        a.rank !== b.rank
          ? b.rank - a.rank
          : compareShortestLeast(a.short, b.short)
      )[0];
      let subkey: string | 0 | undefined = undefined;
      switch (matchingEntry?.container) {
        case "@language":
          subkey = term.language ?? (compactValues
            ? compactTerm(
              { termType: TermType.KEYWORD, value: "@none" },
              activeContext,
            )
            : "@none");
          break;
        case "@type":
          subkey = compactValues
            ? compactTerm(term.datatype, activeContext)
            : term.datatype.value;
          break;
        case "@set":
          subkey = 0;
          break;
      }
      return {
        key: getKey(matchingEntry),
        subkey,
        value: valueToJson(
          term,
          compactValues ? activeContext : undefined,
          matchingEntry?.container === "@type"
            ? term.datatype.value
            : matchingEntry?.type,
          matchingEntry?.container === "@language"
            ? term.language
            : matchingEntry?.language,
          !compactValues,
        ),
      };
    }
    const matchingEntry =
        entries.filter((e) =>
          e.container !== "@type" && e.container !== "@language" &&
          e.container !== "@list" &&
          (!e.type || e.type === "@id")
        ).sort((a, b) => compareShortestLeast(a.short, b.short))[0],
      id = termToString(term);
    if (
      flatten || used.has(id) || !subjects.has(id) ||
      (parents.has(id) && parents.get(id) !== parent)
    ) {
      return {
        key: getKey(matchingEntry),
        subkey: matchingEntry?.container === "@set" ? 0 : undefined,
        value: compactValues ? compactTerm(term, activeContext) : { "@id": id },
      };
    }
    used.add(id);
    const list = resolveList(term);
    if (list) {
      // TODO: Match types of list entries
      const listEntry = entries.filter((e) =>
        e.container === "@list"
      ).sort((a, b) => compareShortestLeast(a.short, b.short))[0];
      return {
        key: getKey(listEntry ?? matchingEntry),
        subkey: listEntry ? undefined : "@list",
        value: list,
      };
    }
    return {
      key: getKey(matchingEntry),
      subkey: matchingEntry?.container === "@set" ? 0 : undefined,
      value: resolveMap(subjects.get(id)!, id),
    };
  }

  if (
    (compactArrays || Object.keys(contextPrefix).length) && roots.length !== 1
  ) {
    flatten = true;
  }

  if (flatten) {
    return {
      ...contextPrefix,
      "@graph": [...subjects].map(([id, value]) => {
        if (!value.has("@id")) {
          value.set("@id", [
            id.startsWith("_:")
              ? { termType: TermType.BLANK_NODE, value: id.slice(2) }
              : { termType: TermType.NAMED_NODE, value: id },
          ]);
        }
        return resolveMap(value, undefined);
      }),
    };
  } else if (compactArrays) {
    return {
      ...contextPrefix,
      ...resolveMap(roots[0][1], roots[0][0]),
    };
  } else {
    return roots.map(([k, v]) => resolveMap(v, k));
  }
}

function termToString(term: ContextTerm) {
  if (term.termType === TermType.BLANK_NODE) return `_:${term.value}`;
  return term.value;
}

function valueToJson(
  term: LiteralTerm,
  activeContext?: Context,
  expectedType?: string,
  expectedLanguage?: string,
  alwaysValueObject = false,
): unknown {
  let value, plainLiteral = false;
  switch (term.datatype.value) {
    case XSD_BOOLEAN:
      value = term.value === "true";
      plainLiteral = true;
      break;
    case XSD_INTEGER:
    case XSD_NON_NEGATIVE_INTEGER:
      value = parseInt(term.value);
      plainLiteral = true;
      break;
    case XSD_DOUBLE:
    case XSD_FLOAT:
      value = parseFloat(term.value);
      plainLiteral = true;
      break;
    case XSD_STRING:
      value = term.value;
      plainLiteral = true;
      break;
    case RDF_JSON_LITERAL:
      value = JSON.parse(term.value);
      break;
    default:
      value = term.value;
  }
  const needsType = expectedType !== term.datatype.value &&
      (expectedType || !plainLiteral),
    needsLanguage = term.language && expectedLanguage !== term.language;
  if (needsType || needsLanguage || alwaysValueObject) {
    return {
      "@value": value,
      ...(needsType
        ? {
          "@type": activeContext
            ? compactTerm(term.datatype, activeContext)
            : term.datatype.value,
        }
        : {}),
      ...(needsLanguage ? { "@language": term.language } : {}),
    };
  }
  return value;
}
