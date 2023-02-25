import { MatchesSchema } from "$/deps.ts";
import * as Account from "./Account.ts";
import * as MediaAttachment from "./MediaAttachment.ts";
import * as Poll from "./Poll.ts";
import * as PreviewCard from "./PreviewCard.ts";
import * as FilterResult from "./FilterResult.ts";

export const schema = {
  schema: ["ref", "Status"],
  let: {
    Status: {
      id: "string",
      created_at: "string",
      in_reply_to_id: ["oneof", "string", null],
      in_reply_to_account_id: ["oneof", "string", null],
      sensitive: "boolean",
      spoiler_text: "string",
      visibility: ["enum", "public", "unlisted", "private", "direct"],
      language: ["oneof", "string", null],
      uri: "string",
      url: ["oneof", "string", null],
      replies_count: "integer",
      reblogs_count: "integer",
      favourites_count: "integer",
      edited_at: ["oneof", "string", null],
      content: "string",
      text: ["optional", "string"],
      reblog: ["oneof", ["ref", "Status"], null],
      application: ["optional", {
        name: "string",
        website: ["oneof", "string", null],
      }],
      account: ["ref", "Account"],
      media_attachments: ["array", ["ref", "MediaAttachment"]],
      mentions: ["array", {
        id: "string",
        username: "string",
        url: "string",
        acct: "string",
      }],
      tags: ["array", { name: "string", url: "string" }],
      emojis: ["array", ["ref", "CustomEmoji"]],
      card: ["oneof", ["ref", "PreviewCard"], null],
      poll: ["oneof", ["ref", "Poll"], null],
      favourited: ["optional", "boolean"],
      reblogged: ["optional", "boolean"],
      muted: ["optional", "boolean"],
      bookmarked: ["optional", "boolean"],
      pinned: ["optional", "boolean"],
      filtered: ["optional", ["array", ["ref", "FilterResult"]]],
    },
    ...Account.schema.let,
    MediaAttachment: MediaAttachment.schema.schema,
    ...MediaAttachment.schema.let,
    Poll: Poll.schema.schema,
    PreviewCard: PreviewCard.schema.schema,
    FilterResult: FilterResult.schema.schema,
    ...FilterResult.schema.let,
  },
} as const;

export type Status = MatchesSchema<typeof schema>;
