import { MatchesSchema } from "$/deps.ts";
import * as CustomEmoji from "./CustomEmoji.ts";

export const schema = {
  schema: {
    id: "string",
    expires_at: "string",
    expired: "boolean",
    multiple: "boolean",
    votes_count: "integer",
    voters_count: "integer",
    options: ["array", {
      title: "string",
      votes_count: "integer",
    }],
    emojis: ["array", ["ref", "CustomEmoji"]],
    voted: ["optional", "boolean"],
    own_votes: ["optional", ["array", "integer"]],
  },
  let: {
    CustomEmoji: CustomEmoji.schema.schema,
  },
} as const;

export type Poll = MatchesSchema<typeof schema>;
