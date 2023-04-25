import { assertMatchesSchema, MatchesSchema } from "$/deps.ts";

export type Keyword =
  | "@base"
  | "@container"
  | "@context"
  | "@default"
  | "@direction"
  | "@embed"
  | "@explicit"
  | "@graph"
  | "@id"
  | "@included"
  | "@import"
  | "@index"
  | "@json"
  | "@language"
  | "@list"
  | "@nest"
  | "@none"
  | "@omitDefault"
  | "@prefix"
  | "@preserve"
  | "@propagate"
  | "@protected"
  | "@requireAll"
  | "@reverse"
  | "@set"
  | "@type"
  | "@value"
  | "@version"
  | "@vocab";

export type Container =
  | "@list"
  | "@set"
  | "@language"
  | "@index"
  | "@id"
  | "@graph"
  | "@type";

export function isKeyword(x: unknown): x is Keyword {
  switch (x) {
    case "@base":
    case "@container":
    case "@context":
    case "@default":
    case "@direction":
    case "@embed":
    case "@explicit":
    case "@graph":
    case "@id":
    case "@included":
    case "@import":
    case "@index":
    case "@json":
    case "@language":
    case "@list":
    case "@nest":
    case "@none":
    case "@omitDefault":
    case "@prefix":
    case "@preserve":
    case "@propagate":
    case "@protected":
    case "@requireAll":
    case "@reverse":
    case "@set":
    case "@type":
    case "@value":
    case "@version":
    case "@vocab":
      return true;
  }
  return false;
}

const ContextSchemaDefs = {
  ContextDefinition: {
    "@base": ["optional", ["oneof", null, "string"]],
    "@import": ["optional", "string"],
    "@language": ["optional", ["oneof", null, "string"]],
    "@propagate": ["optional", "boolean"],
    "@protected": ["optional", "boolean"],
    "@type": ["optional", {
      "@container": ["enum", "@set"],
      "@protected": ["optional", "boolean"],
    }],
    "@version": ["optional", ["enum", 1, 1.1]],
    "@vocab": ["optional", ["oneof", null, "string"]],
  },
  TermDefinition: ["oneof", null, "string", ["ref", "ExpandedTermDefinition"]],
  ExpandedTermDefinition: {
    "@id": ["optional", ["oneof", null, "string"]],
    "@reverse": ["optional", "string"],
    "@type": ["optional", ["oneof", null, "string"]],
    "@language": ["optional", ["oneof", null, "string"]],
    "@container": ["optional", [
      "oneof",
      null,
      ["ref", "ContainerType"],
      ["array", ["ref", "ContainerType"]],
    ]],
    "@context": ["optional", ["ref", "ContextDefinition"]],
    "@nest": ["optional", "string"],
    "@prefix": ["optional", "boolean"],
    "@propagate": ["optional", "boolean"],
    "@protected": ["optional", "boolean"],
  },
  ContainerType: [
    "enum",
    "@list",
    "@set",
    "@language",
    "@index",
    "@id",
    "@graph",
    "@type",
  ],
} as const;

export const ContextDefinitionSchema = {
  spartan: 1,
  schema: ["ref", "ContextDefinition"],
  let: ContextSchemaDefs,
} as const;

export const TermDefinitionsSchema = {
  spartan: 1,
  schema: ["dictionary", ["ref", "TermDefinition"]],
  let: ContextSchemaDefs,
} as const;

export const ExpandedTermDefitionSchema = {
  spartan: 1,
  schema: ["ref", "ExpandedTermDefinition"],
  let: ContextSchemaDefs,
} as const;

export const DocumentSchema = {
  spartan: 1,
  schema: {
    "@context": ["optional", ["oneof", "string", [
      "ref",
      "ContextDefinition",
    ], ["array", ["oneof", "string", ["ref", "ContextDefinition"]]]]],
  },
  let: ContextSchemaDefs,
} as const;

export type ContextDefinitionMeta = MatchesSchema<
  typeof ContextDefinitionSchema
>;

export type TermDefinitions = MatchesSchema<typeof TermDefinitionsSchema>;

export type TermDefinition = TermDefinitions[string];

export type ExpandedTermDefinition = MatchesSchema<
  typeof ExpandedTermDefitionSchema
>;

export type DocumentMeta = MatchesSchema<typeof DocumentSchema>;

export type ContextDefinition =
  & ContextDefinitionMeta
  & Omit<TermDefinitions, `@${string}`>;

export type ContextSrc =
  | string
  | ContextDefinition
  | (string | ContextDefinition)[];

export type Document = Record<string, unknown> & {
  "@context"?: ContextSrc;
  "@graph"?: Record<string, unknown>[];
};

type Asserts<T> = (value: unknown, message?: string) => asserts value is T;

const assertContextDefinitionMeta: Asserts<ContextDefinitionMeta> =
  assertMatchesSchema(ContextDefinitionSchema);
const assertTermDefinitions: Asserts<TermDefinitions> = assertMatchesSchema(
  TermDefinitionsSchema,
);

export const assertContextDefinition: Asserts<ContextDefinition> = (
  context,
  message?,
) => {
  assertContextDefinitionMeta(context, message);
  const defs = Object.fromEntries(
    Object.entries(context).filter(([k]) => !k.startsWith("@")),
  );
  assertTermDefinitions(defs, message);
};

export enum TermType {
  NAMED_NODE = "NamedNode",
  BLANK_NODE = "BlankNode",
  LITERAL = "Literal",
  DEFAULT_GRAPH = "DefaultGraph",
  KEYWORD = "Keyword",
}

export interface NamedNodeTerm {
  termType: TermType.NAMED_NODE;
  value: string;
}

export interface BlankNodeTerm {
  termType: TermType.BLANK_NODE;
  value: string;
  preserve?: boolean;
}

export interface LiteralTerm {
  termType: TermType.LITERAL;
  value: string;
  language?: string;
  datatype: NamedNodeTerm;
}

export interface DefaultGraphTerm {
  termType: TermType.DEFAULT_GRAPH;
  value: string;
}

export interface KeywordTerm {
  termType: TermType.KEYWORD;
  value: Keyword;
}

export type Term =
  | NamedNodeTerm
  | BlankNodeTerm
  | LiteralTerm
  | DefaultGraphTerm;

export type SubjectTerm = NamedNodeTerm | BlankNodeTerm;
export type PredicateTerm = NamedNodeTerm;
export type ObjectTerm = NamedNodeTerm | BlankNodeTerm | LiteralTerm;
export type GraphTerm = NamedNodeTerm | BlankNodeTerm | DefaultGraphTerm;
export type ContextTerm = NamedNodeTerm | BlankNodeTerm | KeywordTerm;

export interface Quad {
  subject: SubjectTerm;
  predicate: PredicateTerm;
  object: ObjectTerm;
  graph: GraphTerm;
}

export interface TreeLink {
  parent?: SubjectTerm;
  child: SubjectTerm;
}

export type RdfEvent = Quad | TreeLink;
