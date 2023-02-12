import { matchesSchema } from "https://deno.land/x/spartanschema@v1.0.1/mod.ts";
import { InjectableAbstract, Singleton } from "$/lib/inject.ts";
import { schema } from "$/schemas/tapir/ServerConfig.ts";

export interface ServerConfig {
  loginName: string;
  url: string;
  domain: string;
  dataDir: string;
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}

const isValidConfig = matchesSchema(schema);

@InjectableAbstract()
export abstract class ServerConfigStore {
  abstract getServerConfig(): Promise<ServerConfig>;
}

@Singleton(ServerConfigStore)
export class MockServerConfigStore implements ServerConfigStore {
  private readonly config: Promise<ServerConfig> = (async () => {
    const config = await Deno.readTextFile("tapir.json"),
      json = JSON.parse(config);
    if (!isValidConfig(json)) {
      throw new TypeError("tapir.json is not a valid config file");
    }
    const publicKey = await crypto.subtle.importKey(
      "jwk",
      json.publicKey as any,
      {
        name: "RSASSA-PKCS1-v1_5",
        hash: { name: "SHA-256" },
      },
      true,
      ["verify"],
    );
    const privateKey = await crypto.subtle.importKey(
      "jwk",
      json.privateKey as any,
      {
        name: "RSASSA-PKCS1-v1_5",
        hash: { name: "SHA-256" },
      },
      true,
      ["sign"],
    );
    return { ...json, publicKey, privateKey };
  })();

  getServerConfig() {
    return this.config;
  }
}
