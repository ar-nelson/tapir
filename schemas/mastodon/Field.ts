import { MatchesSchema } from "https://deno.land/x/spartanschema@v1.0.1/mod.ts";

export const schema = {
  schema: {
    name: "string",
    value: "string",
    verified_at: ["oneof", "string", null],
  },
} as const;

export type Field = MatchesSchema<typeof schema>;
