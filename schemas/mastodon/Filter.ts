import { MatchesSchema } from "https://deno.land/x/spartanschema@v1.0.1/mod.ts";
import * as FilterKeyword from "./FilterKeyword.ts";
import * as FilterStatus from "./FilterStatus.ts";

export const schema = {
  schema: {
    id: "string",
    title: "string",
    context: ["array", [
      "enum",
      "home",
      "notifications",
      "public",
      "thread",
      "account",
    ]],
    expires_at: ["oneof", "string", null],
    filter_action: "string", // "warn" or "hide", but unknown = "warn"
    keywords: ["array", ["ref", "FilterKeyword"]],
    statuses: ["array", ["ref", "FilterStatus"]],
  },
  let: {
    FilterKeyword: FilterKeyword.schema.schema,
    FilterStatus: FilterStatus.schema.schema,
  },
} as const;

export type Filter = MatchesSchema<typeof schema>;
