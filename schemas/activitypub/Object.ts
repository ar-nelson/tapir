import { MatchesSchema } from "https://deno.land/x/spartanschema@v1.0.1/mod.ts";
import { key } from "$/schemas/activitypub/namespace.ts";

export const ObjectCommon = {
  "@id": ["optional", "string"],
  "@type": ["optional", "string"],
  [key.attachment]: ["optional", ["ref", "ObjectOrLinkRefs"]],
  [key.attributedTo]: ["optional", ["ref", "ObjectOrLinkRefs"]],
  [key.audience]: ["optional", ["ref", "ObjectOrLinkRefs"]],
  [key.content]: ["optional", "string"],
  [key.context]: ["optional", ["ref", "ObjectOrLinkRefs"]],
  [key.name]: ["optional", "string"],
  [key.endTime]: ["optional", "string"],
  [key.generator]: ["optional", ["ref", "ObjectOrLinkRef"]],
  [key.icon]: ["optional", ["ref", "ObjectOrLinkRefs"]],
  [key.image]: ["optional", ["ref", "ObjectOrLinkRefs"]],
  [key.inReplyTo]: ["optional", ["oneof", null, ["ref", "ObjectOrLinkRefs"]]],
  [key.location]: ["optional", ["ref", "ObjectOrLinkRefs"]],
  [key.preview]: ["optional", ["ref", "ObjectOrLinkRef"]],
  [key.published]: ["optional", "string"],
  [key.replies]: ["optional", ["ref", "Collection"]],
  [key.startTime]: ["optional", "string"],
  [key.summary]: ["optional", ["oneof", null, "string"]],
  [key.tag]: ["optional", ["ref", "ObjectOrLinkRefs"]],
  [key.updated]: ["optional", "string"],
  [key.url]: ["optional", ["ref", "LinkRefs"]],
  [key.to]: ["optional", ["ref", "ObjectOrLinkRefs"]],
  [key.bto]: ["optional", ["ref", "ObjectOrLinkRefs"]],
  [key.cc]: ["optional", ["ref", "ObjectOrLinkRefs"]],
  [key.bcc]: ["optional", ["ref", "ObjectOrLinkRefs"]],
  [key.mediaType]: ["optional", "string"],
  [key.duration]: ["optional", "string"],
} as const;

export const CollectionCommon = {
  ...ObjectCommon,
  [key.totalItems]: "integer",
  [key.current]: ["optional", ["ref", "CollectionPageOrLinkRef"]],
  [key.first]: ["optional", ["ref", "CollectionPageOrLinkRef"]],
  [key.last]: ["optional", ["ref", "CollectionPageOrLinkRef"]],
  [key.items]: ["optional", ["oneof", ["ref", "ObjectOrLinkRefs"], {
    "@list": ["array", ["ref", "ObjectOrLinkRef"]],
  }]],
} as const;

export const commonDefs = {
  Object: ObjectCommon,
  Link: {
    "@type": ["optional", ["enum", key.Link]],
    [key.href]: "string",
    [key.rel]: ["optional", "string"],
    [key.hreflang]: ["optional", "string"],
    [key.mediaType]: ["optional", "string"],
    [key.name]: ["optional", "string"],
    [key.height]: ["optional", "integer"],
    [key.width]: ["optional", "integer"],
    [key.preview]: ["optional", ["ref", "ObjectOrLinkRef"]],
  },
  Collection: CollectionCommon,
  CollectionPage: {
    ...CollectionCommon,
    [key.partOf]: ["optional", ["oneof", "string", ["ref", "Collection"], [
      "ref",
      "Link",
    ]]],
    [key.next]: ["optional", ["ref", "CollectionPageOrLinkRef"]],
    [key.prev]: ["optional", ["ref", "CollectionPageOrLinkRef"]],
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
export type Collection = MatchesSchema<typeof CollectionSchema>;
export type CollectionPage = MatchesSchema<typeof CollectionPageSchema>;
