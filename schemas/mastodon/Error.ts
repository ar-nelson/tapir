import { MatchesSchema } from "https://deno.land/x/spartanschema@v1.0.1/mod.ts";

export const schema = {
  schema: {
    error: "string",
    error_description: ["optional", "string"],
  },
} as const;

export type Error = MatchesSchema<typeof schema>;
