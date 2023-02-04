import { MatchesSchema } from "https://deno.land/x/spartanschema@v1.0.1/mod.ts";

export const schema = {
  schema: {
    id: "string",
    keyword: "string",
    whole_word: "boolean",
  },
} as const;

export type FilterKeyword = MatchesSchema<typeof schema>;
