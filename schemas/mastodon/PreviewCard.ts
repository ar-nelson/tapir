import { MatchesSchema } from "$/deps.ts";

export const schema = {
  schema: {
    url: "string",
    title: "string",
    description: "string",
    type: ["enum", "link", "photo", "video", "rich"],
    author_name: "string",
    author_url: "string",
    provider_name: "string",
    provider_url: "string",
    html: "string",
    width: "string",
    height: "string",
    image: ["oneof", "string", null],
    embed_url: "string",
    blurhash: ["oneof", "string", null],
    history: ["optional", ["array", {
      day: "string",
      accounts: "string",
      uses: "string",
    }]],
  },
} as const;

export type PreviewCard = MatchesSchema<typeof schema>;
