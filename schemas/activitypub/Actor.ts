import {
  MatchesSchema,
  matchesSchema,
} from "https://deno.land/x/spartanschema@v1.0.1/mod.ts";
import { commonDefs, ObjectCommon } from "$/schemas/activitypub/Object.ts";

export const schema = {
  schema: {
    ...ObjectCommon,

    id: "string",
    type: [
      "enum",
      "Application",
      "Group",
      "Organization",
      "Person",
      "Service",
    ],

    inbox: "string",
    outbox: "string",
    followers: "string",
    following: "string",

    liked: ["optional", "string"],
    streams: ["optional", ["array", "string"]],
    name: "string",
    preferredUsername: "string",
    endpoints: ["optional", {
      proxyUrl: ["optional", "string"],
      oauthAuthorizationEndpoint: ["optional", "string"],
      provideClientKey: ["optional", "string"],
      signClientKey: ["optional", "string"],
      sharedInbox: ["optional", "string"],
    }],

    publicKey: ["optional", {
      id: "string",
      owner: "string",
      publicKeyPem: "string",
    }],

    manuallyApprovesFollowers: ["optional", "boolean"],
    discoverable: ["optional", "boolean"],
    featured: ["optional", "string"],
    featuredTags: ["optional", "string"],
    devices: ["optional", "string"],
  },
  let: commonDefs,
} as const;

export type Actor = MatchesSchema<typeof schema>;

export const isActor = matchesSchema(schema);
