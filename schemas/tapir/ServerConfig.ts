import { MatchesSchema } from "https://deno.land/x/spartanschema@v1.0.1/mod.ts";

export const schema = {
  schema: {
    loginName: "string",
    url: "string",
    domain: "string",
    dataDir: "string",
  },
} as const;

export type ServerConfig = MatchesSchema<typeof schema>;
