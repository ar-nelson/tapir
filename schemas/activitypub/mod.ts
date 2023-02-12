export {
  CollectionPageSchema,
  CollectionSchema,
  LinkSchema,
  ObjectSchema,
} from "./Object.ts";
export { schema as ActorSchema } from "./Actor.ts";
export { schema as ActivitySchema } from "./Activity.ts";
export { key } from "./namespace.ts";

export type { Collection, CollectionPage, Link, Object } from "./Object.ts";
export type { Actor } from "./Actor.ts";
export type { Activity } from "./Activity.ts";

export const CONTENT_TYPE =
  'application/ld+json; profile="https://www.w3.org/ns/activitystreams"';
