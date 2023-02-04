import { MatchesSchema } from "https://deno.land/x/spartanschema@v1.0.1/mod.ts";
import * as Emoji from "./Emoji.ts";
import * as ProfileField from "./ProfileField.ts";

export const schema = {
  schema: {
    id: "string",
    username: "string",
    acct: "string",
    display_name: "string",
    locked: "boolean",
    bot: "boolean",
    discoverable: "boolean",
    group: "boolean",
    created_at: "string",
    note: "string",
    url: "string",
    avatar: "string",
    avatar_static: "string",
    header: "string",
    header_static: "string",
    followers_count: "number",
    following_count: "number",
    statuses_count: "number",
    last_status_at: "string",
    emojis: ["array", ["ref", "Emoji"]],
    fields: ["array", ["ref", "ProfileField"]],
  },
  let: {
    Emoji: Emoji.schema.schema,
    ProfileField: ProfileField.schema.schema,
  },
} as const;

export type Account = MatchesSchema<typeof schema>;
