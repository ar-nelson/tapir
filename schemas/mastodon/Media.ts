import { MatchesSchema } from "https://deno.land/x/spartanschema@v1.0.1/mod.ts";

export const schema = {
  schema: {
    id: "string",
    type: "string",
    url: "string",
    preview_url: "string",
    remote_url: "string",
    preview_remote_url: ["oneof", "string", null],
    text_url: ["oneof", "string", null],
    meta: {
      original: ["optional", ["ref", "ImageMeta"]],
      small: ["optional", ["ref", "ImageMeta"]],
    },
    description: ["oneof", "string", null],
    blurhash: "string",
  },
  let: {
    ImageMeta: {
      width: "number",
      height: "number",
      size: "string",
      aspect: "number",
    },
  },
} as const;

export type Media = MatchesSchema<typeof schema>;
