import { MatchesSchema } from "$/deps.ts";

export const schema = {
  schema: {
    id: "string",
    keyword: "string",
    whole_word: "boolean",
  },
} as const;

export type FilterKeyword = MatchesSchema<typeof schema>;
