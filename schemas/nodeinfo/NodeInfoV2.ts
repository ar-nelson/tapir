import { assertMatchesSchema, MatchesSchema } from "$/deps.ts";
import { AssertFn } from "$/lib/utils.ts";

export const NodeInfoV2Schema = {
  schema: {
    version: ["enum", "2.0", "2.1"],
    software: {
      name: "string",
      version: "string",
      repository: ["optional", "string"],
      homepage: ["optional", "string"],
    },
    protocols: ["array", "string"],
    services: {
      inbound: ["array", "string"],
      outbound: ["array", "string"],
    },
    usage: {
      users: {
        total: ["optional", "integer"],
        activeMonth: ["optional", "integer"],
        activeHalfyear: ["optional", "integer"],
      },
      localPosts: ["optional", "integer"],
      localComments: ["optional", "integer"],
    },
    openRegistrations: "boolean",
  },
} as const;

export type NodeInfoV2 = MatchesSchema<typeof NodeInfoV2Schema> & {
  metadata: Record<string, unknown>;
};

export const assertIsNodeInfoV2: AssertFn<NodeInfoV2> = assertMatchesSchema(
  NodeInfoV2Schema,
);
