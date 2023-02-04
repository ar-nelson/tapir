import { MatchesSchema } from "https://deno.land/x/spartanschema@v1.0.1/mod.ts";

export const schema = {
  schema: {
    id: "string",
    type: ["enum", "unknown", "image", "gifv", "video", "audio"],
    url: "string",
    preview_url: "string",
    remote_url: ["oneof", "string", null],
    preview_remote_url: ["oneof", "string", null],
    text_url: ["oneof", "string", null],
    meta: {
      length: ["optional", "string"],
      duration: ["optional", "float"],
      fps: ["optional", "float"],
      size: ["optional", "string"],
      width: ["optional", "integer"],
      height: ["optional", "integer"],
      aspect: ["optional", "float"],
      audio_encode: ["optional", "string"],
      audio_bitrate: ["optional", "string"],
      audio_channels: ["optional", "string"],
      original: ["optional", ["ref", "MetaSize"]],
      small: ["optional", ["ref", "MetaSize"]],
      focus: ["optional", { x: "float", y: "float" }],
    },
    description: ["oneof", "string", null],
    blurhash: ["oneof", "string", null],
  },
  let: {
    MetaSize: {
      length: ["optional", "string"],
      duration: ["optional", "float"],
      frame_rate: ["optional", "string"],
      size: ["optional", "string"],
      width: ["optional", "integer"],
      height: ["optional", "integer"],
      aspect: ["optional", "float"],
      bitrate: ["optional", "integer"],
    },
  },
} as const;

export type MediaAttachment = MatchesSchema<typeof schema>;
