import { MatchesSchema } from "https://deno.land/x/spartanschema@v1.0.1/mod.ts";
import * as Filter from "./Filter.ts";

export const schema = {
  schema: {
    filter: ["ref", "Filter"],
    keyword_matches: ["oneof", ["array", "string"], null],
    status_matches: ["oneof", "string", null],
  },
  let: {
    Filter: Filter.schema.schema,
    ...Filter.schema.let,
  },
} as const;

export type FilterResult = MatchesSchema<typeof schema>;
