import { MatchesSchema } from "$/deps.ts";

export const schema = {
  schema: {
    subject: "string",
    aliases: ["array", "string"],
    links: ["array", {
      rel: "string",
      href: ["optional", "string"],
      type: ["optional", "string"],
      template: ["optional", "string"],
    }],
  },
} as const;

export type WebFingerResponse = MatchesSchema<typeof schema>;
