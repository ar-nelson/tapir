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
export { assertIsActor, isActor } from "./Actor.ts";
export { assertIsActivity, isActivity } from "./Activity.ts";
export { key } from "./namespace.ts";

export type {
  Collection,
  CollectionPage,
  Link,
  LinkRefs,
  Object,
} from "./Object.ts";
export type { Actor } from "./Actor.ts";
export type { Activity } from "./Activity.ts";

import DEFAULT_CONTEXT from "$/resources/jsonld/defaultContext.json" assert {
  type: "json",
};
export const defaultContext = DEFAULT_CONTEXT;

export const CONTENT_TYPE =
  'application/ld+json; profile="https://www.w3.org/ns/activitystreams"';
