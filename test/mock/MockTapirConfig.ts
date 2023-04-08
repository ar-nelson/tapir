import { TapirConfig } from "$/models/TapirConfig.ts";
import type { TapirConfig as TapirConfigSchema } from "$/schemas/tapir/TapirConfig.ts";

export class MockTapirConfig extends TapirConfig {
  constructor(config: TapirConfigSchema = {}) {
    super({
      loggers: [{ type: "console", level: "DEBUG" }],
      localDatabase: { type: "inmemory" },
      localMedia: { type: "inmemory" },
      remoteDatabase: { type: "inmemory" },
      remoteMedia: { type: "inmemory" },
      port: 42069,
      ...config,
    });
  }
}
