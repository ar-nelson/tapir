import { MatchesSchema } from "https://deno.land/x/spartanschema@v1.0.1/mod.ts";

export const schema = {
  schema: {
    id: "string",
    status_id: "string",
  },
} as const;

export type FilterStatus = MatchesSchema<typeof schema>;
