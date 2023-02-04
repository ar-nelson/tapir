import { MatchesSchema } from "https://deno.land/x/spartanschema@v1.0.1/mod.ts";
import * as Account from "./Account.ts";
import * as Media from "./Media.ts";

export const schema = {
  schema: {
    id: "string",
    created_at: "string",
    in_reply_to_id: ["oneof", "string", null],
    in_reply_to_account_id: ["oneof", "string", null],
    sensitive: "boolean",
    spoiler_text: "string",
    visibility: "string",
    language: "string",
    uri: "string",
    url: "string",
    replies_count: "integer",
    reblogs_count: "integer",
    favourites_count: "integer",
    edited_at: ["oneof", "string", null],
    content: "string",
    reblog: ["oneof", "string", null],
    application: ["optional", {
      name: "string",
      website: ["optional", "string"],
    }],
    account: ["ref", "Account"],
    media_attachments: ["array", ["ref", "Media"]],
    mentions: ["array", null],
    tags: ["array", { name: "string", url: "string" }],
    emojis: ["array", ["ref", "Emoji"]],
    card: null,
    poll: null,
  },
  let: {
    Account: Account.schema.schema,
    Media: Media.schema.schema,
    ...Account.schema.let,
    ...Media.schema.let,
  },
} as const;

export type MastodonPost = MatchesSchema<typeof schema>;
