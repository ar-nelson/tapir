import { InjectableAbstract, Singleton } from "$/lib/inject.ts";
import { generateKeyPair } from "$/lib/signatures.ts";

export interface ServerConfig {
  loginName: string;
  url: string;
  domain: string;
  dataDir: string;
  keyPair: CryptoKeyPair;
}

@InjectableAbstract()
export abstract class ServerConfigStore {
  abstract getServerConfig(): Promise<ServerConfig>;
}

const MOCK_SERVER_CONFIG = {
  loginName: "tapir",
  url: "https://tapir.social",
  domain: "tapir.social",
  dataDir: "data",
};

@Singleton(ServerConfigStore)
export class MockServerConfigStore implements ServerConfigStore {
  private readonly config: Promise<ServerConfig> = (async () => {
    const keyPair = await generateKeyPair();
    return { ...MOCK_SERVER_CONFIG, keyPair };
  })();

  getServerConfig() {
    return this.config;
  }
}
