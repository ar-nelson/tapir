import { MatchesSchema } from "$/deps.ts";

export const schema = {
  schema: {
    error: "string",
    error_description: ["optional", "string"],
  },
} as const;

export type Error = MatchesSchema<typeof schema>;
