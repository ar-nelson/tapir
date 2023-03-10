import { MatchesSchema } from "$/deps.ts";

export const schema = {
  schema: {
    shortcode: "string",
    url: "string",
    static_url: "string",
    visible_in_picker: "boolean",
    category: ["optional", "string"],
  },
} as const;

export type CustomEmoji = MatchesSchema<typeof schema>;
