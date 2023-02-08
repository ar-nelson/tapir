import { MatchesSchema } from "https://deno.land/x/spartanschema@v1.0.1/mod.ts";
import { commonDefs, ObjectCommon } from "$/schemas/activitypub/Object.ts";
import { key } from "$/schemas/activitypub/namespace.ts";

export const schema = {
  schema: {
    ...ObjectCommon,

    "@id": "string",
    "@type": [
      "enum",
      key.Application,
      key.Group,
      key.Organization,
      key.Person,
      key.Service,
    ],

    [key.inbox]: "string",
    [key.outbox]: "string",
    [key.followers]: "string",
    [key.following]: "string",

    [key.liked]: ["optional", "string"],
    [key.streams]: ["optional", ["array", "string"]],
    [key.preferredUsername]: ["optional", "string"],
    [key.endpoints]: ["optional", {
      [key.proxyUrl]: ["optional", "string"],
      [key.oauthAuthorizationEndpoint]: ["optional", "string"],
      [key.provideClientKey]: ["optional", "string"],
      [key.signClientKey]: ["optional", "string"],
      [key.sharedInbox]: ["optional", "string"],
    }],

    [key.publicKey]: {
      "@id": ["optional", "string"],
      [key.owner]: "string",
      [key.publicKeyPem]: "string",
    },
    [key.manuallyApprovesFollowers]: ["optional", "boolean"],
    [key.discoverable]: ["optional", "boolean"],
    [key.featured]: ["optional", "string"],
    [key.featuredTags]: ["optional", "string"],
    [key.devices]: ["optional", "string"],
  },
  let: commonDefs,
} as const;

export type Actor = MatchesSchema<typeof schema>;
