import { MatchesSchema } from "https://deno.land/x/spartanschema@v1.0.1/mod.ts";

export const schema = {
  schema: {
    loginName: "string",
    passwordHash: "string",
    passwordSalt: "string",
    url: "string",
    domain: "string",
    dataDir: "string",
    localDatabase: ["ref", "DatabaseConfig"],
    publicKey: {
      kty: ["enum", "RSA"],
      alg: ["enum", "RS256"],
      n: "string",
      e: "string",
      key_ops: ["tuple", ["enum", "verify"]],
      ext: ["enum", true],
    },
    privateKey: {
      kty: ["enum", "RSA"],
      alg: ["enum", "RS256"],
      n: "string",
      e: "string",
      d: "string",
      p: "string",
      q: "string",
      dp: "string",
      dq: "string",
      qi: "string",
      key_ops: ["tuple", ["enum", "sign"]],
      ext: ["enum", true],
    },
  },
  let: {
    DatabaseConfig: ["oneof", { "type": ["enum", "inmemory"] }, {
      "type": ["enum", "sqlite"],
      "path": ["optional", "string"],
    }],
  },
} as const;

export type ServerConfig = MatchesSchema<typeof schema>;
