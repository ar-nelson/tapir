import { checkPersonaName } from "$/lib/utils.ts";
import { InjectableAbstract, Singleton } from "$/lib/inject.ts";
import { isServerConfig } from "$/schemas/tapir/ServerConfig.ts";
import { generateKeyPair } from "$/lib/signatures.ts";
import { base64 } from "$/deps.ts";

export type DatabaseConfig = { readonly type: "inmemory" } | {
  readonly type: "sqlite";
  readonly path?: string;
};

export type RepoConfig = { readonly type: "inmemory" } | {
  readonly type: "file";
  readonly path?: string;
};

export interface ServerConfig {
  readonly loginName: string;
  readonly passwordHash: Uint8Array;
  readonly passwordSalt: Uint8Array;
  readonly mediaSalt: Uint8Array;
  readonly url: string;
  readonly domain: string;
  readonly dataDir: string;
  readonly localDatabase: DatabaseConfig;
  readonly localMedia: RepoConfig;
  readonly publicKey: CryptoKey;
  readonly privateKey: CryptoKey;
}

@InjectableAbstract()
export abstract class ServerConfigStore {
  abstract getServerConfig(): Promise<ServerConfig>;
}

@Singleton(ServerConfigStore)
export class FileServerConfigStore implements ServerConfigStore {
  private readonly config: Promise<ServerConfig> = (async () => {
    const config = await Deno.readTextFile("tapir.json"),
      json = JSON.parse(config);
    if (!isServerConfig(json)) {
      throw new TypeError("tapir.json is not a valid config file");
    }
    checkPersonaName(json.loginName);
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
    return {
      ...json,
      passwordHash: base64.decode(json.passwordHash),
      passwordSalt: base64.decode(json.passwordSalt),
      mediaSalt: base64.decode(json.mediaSalt),
      publicKey,
      privateKey,
    };
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
    passwordHash: base64.decode("N63CXrwv0u0U7ziMTLeHh6/Qg/qoXpAB4jyzqFtmttM="), // password: "iamatapir"
    passwordSalt: base64.decode("EtVFrF66Kt11z9g10fERFg=="),
    mediaSalt: base64.decode("AAAAAAAA"),
    url: "https://tapir.social",
    domain: "tapir.social",
    dataDir: "data",
    localDatabase: { type: "inmemory" },
    localMedia: { type: "inmemory" },
    publicKey,
    privateKey,
  }));

  getServerConfig() {
    return this.config;
  }
}
