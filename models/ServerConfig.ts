import { ServerConfig } from "../schemas/tapir/ServerConfig.ts";
export type { ServerConfig } from "../schemas/tapir/ServerConfig.ts";

export interface ServerConfigStore {
  getServerConfig(): Promise<ServerConfig>;
}

const MOCK_SERVER_CONFIG: ServerConfig = {
  loginName: "tapir",
  url: "http://localhost:8000",
  dataDir: "data",
};

export class MockServerConfigStore implements ServerConfigStore {
  async getServerConfig(): Promise<ServerConfig> {
    return MOCK_SERVER_CONFIG;
  }
}

export const serverConfigStore = new MockServerConfigStore();

