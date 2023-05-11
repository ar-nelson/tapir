import { assertMatchesSchema, MatchesSchema } from "$/deps.ts";
import { AssertFn } from "$/lib/utils.ts";

export const NodeInfoDirectorySchema = {
  schema: {
    links: ["array", {
      rel: "string",
      href: "string",
    }],
  },
} as const;

export type NodeInfoDirectory = MatchesSchema<typeof NodeInfoDirectorySchema>;

export const assertIsNodeInfoDirectory: AssertFn<NodeInfoDirectory> =
  assertMatchesSchema(NodeInfoDirectorySchema);
