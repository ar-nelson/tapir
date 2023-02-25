import { MatchesSchema } from "$/deps.ts";

export const schema = {
  schema: {
    id: "string",
    status_id: "string",
  },
} as const;

export type FilterStatus = MatchesSchema<typeof schema>;
