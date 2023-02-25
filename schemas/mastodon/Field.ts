import { MatchesSchema } from "$/deps.ts";

export const schema = {
  schema: {
    name: "string",
    value: "string",
    verified_at: ["oneof", "string", null],
  },
} as const;

export type Field = MatchesSchema<typeof schema>;
