import { InjectableAbstract, Singleton } from "$/lib/inject.ts";
import { ServerConfig } from "$/schemas/tapir/ServerConfig.ts";
export type { ServerConfig } from "$/schemas/tapir/ServerConfig.ts";

@InjectableAbstract()
export abstract class ServerConfigStore {
  abstract getServerConfig(): Promise<ServerConfig>;
}

const MOCK_SERVER_CONFIG: ServerConfig = {
  loginName: "tapir",
  url: "http://localhost:8000",
  domain: "tapir.social",
  dataDir: "data",
};

@Singleton(ServerConfigStore)
export class MockServerConfigStore implements ServerConfigStore {
  async getServerConfig() {
    return MOCK_SERVER_CONFIG;
  }
}
