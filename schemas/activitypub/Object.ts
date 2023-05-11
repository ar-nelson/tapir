import { assertMatchesSchema, MatchesSchema, matchesSchema } from "$/deps.ts";
import { AssertFn } from "$/lib/utils.ts";

export const ObjectCommon = {
  id: ["optional", "string"],
  type: ["optional", "string"],
  attachment: ["optional", ["ref", "ObjectOrLinkRefs"]],
  attributedTo: ["optional", ["ref", "ObjectOrLinkRefs"]],
  audience: ["optional", ["ref", "ObjectOrLinkRefs"]],
  content: ["optional", "string"],
  context: ["optional", ["ref", "ObjectOrLinkRefs"]],
  name: ["optional", "string"],
  endTime: ["optional", "string"],
  generator: ["optional", ["ref", "ObjectOrLinkRef"]],
  icon: ["optional", ["ref", "ObjectOrLinkRefs"]],
  image: ["optional", ["ref", "ObjectOrLinkRefs"]],
  inReplyTo: ["optional", ["oneof", null, ["ref", "ObjectOrLinkRefs"]]],
  location: ["optional", ["ref", "ObjectOrLinkRefs"]],
  preview: ["optional", ["ref", "ObjectOrLinkRef"]],
  published: ["optional", "string"],
  replies: ["optional", ["ref", "Collection"]],
  likes: ["optional", ["ref", "Collection"]],
  shares: ["optional", ["ref", "Collection"]],
  startTime: ["optional", "string"],
  summary: ["optional", ["oneof", null, "string"]],
  tag: ["optional", ["ref", "ObjectOrLinkRefs"]],
  updated: ["optional", "string"],
  url: ["optional", ["ref", "LinkRefs"]],
  to: ["optional", ["ref", "ObjectOrLinkRefs"]],
  bto: ["optional", ["ref", "ObjectOrLinkRefs"]],
  cc: ["optional", ["ref", "ObjectOrLinkRefs"]],
  bcc: ["optional", ["ref", "ObjectOrLinkRefs"]],
  mediaType: ["optional", "string"],
  duration: ["optional", "string"],
} as const;

export const CollectionCommon = {
  ...ObjectCommon,
  totalItems: ["optional", "integer"],
  current: ["optional", ["ref", "CollectionPageOrLinkRef"]],
  first: ["optional", ["ref", "CollectionPageOrLinkRef"]],
  last: ["optional", ["ref", "CollectionPageOrLinkRef"]],
  items: ["optional", ["ref", "ObjectOrLinkRefs"]],
  orderedItems: ["optional", ["ref", "ObjectOrLinkRefs"]],
} as const;

export const commonDefs = {
  Object: {
    ...ObjectCommon,
    blurhash: ["optional", "string"],
    sensitive: ["optional", "boolean"],
    focalPoint: ["optional", ["array", "number"]],
    votersCount: ["optional", "integer"],
    oneOf: ["optional", ["ref", "ObjectOrLinkRefs"]],
    anyOf: ["optional", ["ref", "ObjectOrLinkRefs"]],
  },
  Link: {
    type: ["optional", ["enum", "Link"]],
    href: "string",
    rel: ["optional", "string"],
    hreflang: ["optional", "string"],
    mediaType: ["optional", "string"],
    name: ["optional", "string"],
    height: ["optional", "integer"],
    width: ["optional", "integer"],
    preview: ["optional", ["ref", "ObjectOrLinkRef"]],
  },
  Collection: CollectionCommon,
  CollectionPage: {
    ...CollectionCommon,
    partOf: ["optional", ["oneof", "string", ["ref", "Collection"], [
      "ref",
      "Link",
    ]]],
    next: ["optional", ["ref", "CollectionPageOrLinkRef"]],
    prev: ["optional", ["ref", "CollectionPageOrLinkRef"]],
  },
  ObjectRef: ["oneof", "string", ["ref", "Object"]],
  LinkRef: ["oneof", "string", ["ref", "Link"]],
  LinkRefs: ["oneof", ["ref", "LinkRef"], ["array", ["ref", "LinkRef"]]],
  ObjectOrLinkRef: ["oneof", "string", ["ref", "Object"], ["ref", "Link"]],
  ObjectOrLinkRefs: ["oneof", ["ref", "ObjectOrLinkRef"], ["array", [
    "ref",
    "ObjectOrLinkRef",
  ]]],
  CollectionPageOrLinkRef: ["oneof", "string", ["ref", "CollectionPage"], [
    "ref",
    "Link",
  ]],
} as const;

export const ObjectSchema = {
  schema: ["ref", "Object"],
  let: commonDefs,
} as const;

export const LinkSchema = {
  schema: ["ref", "Link"],
  let: commonDefs,
} as const;

export const LinkRefsSchema = {
  schema: ["ref", "LinkRefs"],
  let: commonDefs,
} as const;

export const CollectionSchema = {
  schema: ["ref", "Collection"],
  let: commonDefs,
} as const;

export const CollectionPageSchema = {
  schema: ["ref", "CollectionPage"],
  let: commonDefs,
} as const;

export type Object = MatchesSchema<typeof ObjectSchema>;
export type Link = MatchesSchema<typeof LinkSchema>;
export type LinkRefs = MatchesSchema<typeof LinkRefsSchema>;
export type Collection = MatchesSchema<typeof CollectionSchema>;
export type CollectionPage = MatchesSchema<typeof CollectionPageSchema>;

export const isObject = matchesSchema(ObjectSchema);
export const isLink = matchesSchema(LinkSchema);
export const isCollection = matchesSchema(CollectionSchema);
export const isCollectionPage = matchesSchema(CollectionPageSchema);

export const assertIsObject: AssertFn<Object> = assertMatchesSchema(
  ObjectSchema,
);
export const assertIsLink: AssertFn<Link> = assertMatchesSchema(LinkSchema);
export const assertIsCollection: AssertFn<Collection> = assertMatchesSchema(
  CollectionSchema,
);
export const assertIsCollectionPage: AssertFn<CollectionPage> =
  assertMatchesSchema(CollectionPageSchema);
