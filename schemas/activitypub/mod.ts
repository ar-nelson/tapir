export {
  default as activityStreamsContextJson,
} from "$/resources/jsonld/activitystreams.json" assert {
  type: "json",
};
export {
  default as defaultContextJson,
} from "$/resources/jsonld/defaultContext.json" assert {
  type: "json",
};
export {
  default as securityContextJson,
} from "$/resources/jsonld/w3id_security.json" assert {
  type: "json",
};
export { assertIsActivity, isActivity } from "./Activity.ts";
export type { Activity } from "./Activity.ts";
export { assertIsActor, isActor } from "./Actor.ts";
export type { Actor } from "./Actor.ts";
export { key } from "./namespace.ts";
export {
  assertIsCollection,
  assertIsCollectionPage,
  assertIsLink,
  assertIsObject,
  isCollection,
  isCollectionPage,
  isLink,
  isObject,
} from "./Object.ts";
export type {
  Collection,
  CollectionPage,
  Link,
  LinkRefs,
  Object,
} from "./Object.ts";

export const CONTENT_TYPE =
  'application/ld+json; profile="https://www.w3.org/ns/activitystreams"';
