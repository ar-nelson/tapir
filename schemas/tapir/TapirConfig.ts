import { assertMatchesSchema, MatchesSchema, matchesSchema } from "$/deps.ts";

export const schema = {
  schema: {
    url: ["optional", "string"],
    domain: ["optional", "string"],
    dataDir: ["optional", "string"],
    port: ["optional", "integer"],

    localDatabase: ["optional", ["oneof", { type: ["enum", "inmemory"] }, {
      type: ["enum", "sqlite"],
      path: ["optional", "string"],
    }]],
    localMedia: ["optional", ["oneof", { type: ["enum", "inmemory"] }, {
      type: ["enum", "file"],
      path: ["optional", "string"],
    }]],

    remoteDatabase: ["optional", ["oneof", {
      type: ["enum", "inmemory"],
      maxObjects: ["optional", ["oneof", null, "integer"]],
    }, {
      type: ["enum", "sqlite"],
      path: ["optional", "string"],
      maxObjects: ["optional", ["oneof", null, "integer"]],
    }]],
    remoteMedia: ["optional", ["oneof", {
      type: ["enum", "inmemory"],
      maxSizeMB: ["optional", ["oneof", null, "integer"]],
    }, {
      type: ["enum", "file"],
      path: ["optional", "string"],
      maxSizeMB: ["optional", ["oneof", null, "integer"]],
    }]],

    loggers: ["optional", ["array", ["oneof", {
      type: ["enum", "console"],
      level: ["ref", "LogLevel"],
      format: ["optional", "string"],
      json: ["optional", "boolean"],
    }, {
      type: ["enum", "file"],
      level: ["ref", "LogLevel"],
      filename: "string",
      format: ["optional", "string"],
      json: ["optional", "boolean"],
      mode: ["optional", ["enum", "a", "w"]],
    }, {
      type: ["enum", "rotatingFile"],
      level: ["ref", "LogLevel"],
      filename: "string",
      maxBytes: "integer",
      maxBackupCount: "integer",
      format: ["optional", "string"],
      json: ["optional", "boolean"],
      mode: ["optional", ["enum", "a", "w"]],
    }]]],

    instance: ["optional", {
      adminEmail: "string",
      displayName: ["optional", "string"],
      summary: ["optional", "string"],
    }],

    auth: ["optional", {
      type: ["enum", "password"],
      username: "string",
      password: "string",
    }],

    mainPersona: ["optional", {
      name: "string",
      displayName: ["optional", "string"],
      summary: ["optional", "string"],
      requestToFollow: ["optional", "boolean"],
    }],
  },
  let: {
    LogLevel: ["enum", "DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"],
  },
} as const;

export type TapirConfig = MatchesSchema<typeof schema>;

export const isTapirConfig = matchesSchema(schema);

export const assertTapirConfig: (
  value: unknown,
  message?: string,
) => asserts value is TapirConfig = assertMatchesSchema(schema);
