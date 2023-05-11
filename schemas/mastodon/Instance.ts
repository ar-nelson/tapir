import { assertMatchesSchema, MatchesSchema } from "$/deps.ts";
import { AssertFn } from "$/lib/utils.ts";
import * as Account from "$/schemas/mastodon/Account.ts";

export const schema = {
  schema: {
    uri: "string",
    title: "string",
    short_description: "string",
    description: "string",
    email: "string",
    version: "string",
    urls: ["dictionary", "string"],
    stats: {
      user_count: "integer",
      status_count: "integer",
      domain_count: "integer",
    },
    thumbnail: ["oneof", "string", null],
    languages: ["array", "string"],
    registrations: "boolean",
    approval_required: "boolean",
    invites_enabled: "boolean",
    configuration: {
      statuses: {
        max_characters: "integer",
        max_media_attachments: "integer",
        characters_reserved_per_url: "integer",
      },
      media_attachments: {
        supported_mime_types: ["array", "string"],
        image_size_limit: "integer",
        image_matrix_limit: "integer",
        video_size_limit: "integer",
        video_frame_rate_limit: "integer",
        video_matrix_limit: "integer",
      },
      polls: {
        max_options: "integer",
        max_characters_per_option: "integer",
        min_expiration: "integer",
        max_expiration: "integer",
      },
    },
    contact_account: ["ref", "Account"],
    rules: ["array", { id: "string", text: "string" }],
  },
  let: {
    ...Account.schema.let,
  },
} as const;

export type Instance = MatchesSchema<typeof schema>;

export const assertIsInstance: AssertFn<Instance> = assertMatchesSchema(schema);
