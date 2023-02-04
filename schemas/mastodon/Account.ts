import { MatchesSchema } from "https://deno.land/x/spartanschema@v1.0.1/mod.ts";
import * as CustomEmoji from "./CustomEmoji.ts";
import * as Field from "./Field.ts";

export const schema = {
  schema: ["ref", "Account"],
  let: {
    Account: {
      id: "string",
      username: "string",
      acct: "string",
      display_name: "string",
      locked: "boolean",
      bot: "boolean",
      discoverable: ["oneof", "boolean", null],
      group: "boolean",
      noindex: ["optional", ["oneof", "boolean", null]],
      moved: ["optional", ["oneof", ["ref", "Account"], null]],
      suspended: ["optional", "boolean"],
      limited: ["optional", "boolean"],
      created_at: "string",
      note: "string",
      url: "string",
      avatar: "string",
      avatar_static: "string",
      header: "string",
      header_static: "string",
      followers_count: "integer",
      following_count: "integer",
      statuses_count: "integer",
      last_status_at: "string",
      emojis: ["array", ["ref", "CustomEmoji"]],
      fields: ["array", ["ref", "ProfileField"]],
    },
    CustomEmoji: CustomEmoji.schema.schema,
    Field: Field.schema.schema,
  },
} as const;

export type Account = MatchesSchema<typeof schema>;
