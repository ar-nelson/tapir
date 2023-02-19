import { matchesSchema } from "https://deno.land/x/spartanschema@v1.0.1/mod.ts";
import { InjectableAbstract, Singleton } from "$/lib/inject.ts";
import { schema } from "$/schemas/tapir/ServerConfig.ts";
import { generateKeyPair } from "$/lib/signatures.ts";

export interface ServerConfig {
  readonly loginName: string;
  readonly url: string;
  readonly domain: string;
  readonly dataDir: string;
  readonly localDatabase: { readonly type: "inmemory" } | {
    readonly type: "sqlite";
    readonly path?: string;
  };
  readonly publicKey: CryptoKey;
  readonly privateKey: CryptoKey;
}

const isValidConfig = matchesSchema(schema);

@InjectableAbstract()
export abstract class ServerConfigStore {
  abstract getServerConfig(): Promise<ServerConfig>;
}

@Singleton(ServerConfigStore)
export class FileServerConfigStore implements ServerConfigStore {
  private readonly config: Promise<ServerConfig> = (async () => {
    const config = await Deno.readTextFile("tapir.json"),
      json = JSON.parse(config);
    if (!isValidConfig(json)) {
      throw new TypeError("tapir.json is not a valid config file");
    }
    const publicKey = await crypto.subtle.importKey(
      "jwk",
      json.publicKey as unknown as JsonWebKey,
      {
        name: "RSASSA-PKCS1-v1_5",
        hash: { name: "SHA-256" },
      },
      true,
      ["verify"],
    );
    const privateKey = await crypto.subtle.importKey(
      "jwk",
      json.privateKey as unknown as JsonWebKey,
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

export class MockServerConfigStore implements ServerConfigStore {
  private readonly config: Promise<ServerConfig> = generateKeyPair().then((
    { publicKey, privateKey },
  ) => ({
    loginName: "tapir",
    url: "https://tapir.social",
    domain: "tapir.social",
    dataDir: "data",
    localDatabase: { type: "inmemory" },
    publicKey,
    privateKey,
  }));

  getServerConfig() {
    return this.config;
  }
}
