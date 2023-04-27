import { log, path, toml } from "$/deps.ts";
import { InjectableAbstract, Singleton } from "$/lib/inject.ts";
import type { TapirConfig as TapirConfigSchema } from "$/schemas/tapir/TapirConfig.ts";
import { assertTapirConfig } from "$/schemas/tapir/TapirConfig.ts";

export type DatabaseConfig = { readonly type: "inmemory" } | {
  readonly type: "sqlite";
  readonly path?: string;
};

export type RepoConfig = { readonly type: "inmemory" } | {
  readonly type: "file";
  readonly path?: string;
};

export type LogLevel = "DEBUG" | "INFO" | "WARNING" | "ERROR" | "CRITICAL";

export type LogConfig = {
  readonly type: "console";
  readonly level: LogLevel;
  readonly format?: string;
  readonly json?: boolean;
} | {
  readonly type: "file";
  readonly level: LogLevel;
  readonly filename: string;
  readonly mode?: "a" | "w";
  readonly format?: string;
  readonly json?: boolean;
} | {
  readonly type: "rotatingFile";
  readonly level: LogLevel;
  readonly filename: string;
  readonly maxBytes: number;
  readonly maxBackupCount: number;
  readonly mode?: "a" | "w";
  readonly format?: string;
  readonly json?: boolean;
};

export const DEFAULT_PROTOCOL = "https://",
  DEFAULT_DOMAIN = "localhost",
  DEFAULT_PORT = 9100,
  DEFAULT_DATA_DIR = "tapir",
  DEFAULT_LOCAL_DATABASE: DatabaseConfig = { type: "sqlite" },
  DEFAULT_LOCAL_SQLITE_PATH = "local.db",
  DEFAULT_LOCAL_MEDIA: RepoConfig = { type: "file" },
  DEFAULT_LOCAL_MEDIA_PATH = "localMedia",
  DEFAULT_REMOTE_DATABASE: DatabaseConfig & {
    readonly maxObjects: number | null;
  } = { type: "inmemory", maxObjects: 65536 },
  DEFAULT_REMOTE_SQLITE_PATH = "remote.db",
  DEFAULT_REMOTE_MEDIA: RepoConfig & { readonly maxSizeMB: number | null } = {
    type: "inmemory",
    maxSizeMB: 512,
  },
  DEFAULT_REMOTE_MEDIA_PATH = "remoteMedia",
  DEFAULT_CONFIG_FILE_JSON = "tapir.json",
  DEFAULT_CONFIG_FILE_TOML = "tapir.toml",
  DEFAULT_LOGGERS: readonly LogConfig[] = [{ type: "console", level: "INFO" }];

@InjectableAbstract()
export abstract class TapirConfig {
  readonly url: string;
  readonly domain: string;
  readonly dataDir: string;
  readonly port: number;
  readonly localDatabase: Required<DatabaseConfig>;
  readonly localMedia: Required<RepoConfig>;
  readonly remoteDatabase: Required<DatabaseConfig> & {
    readonly maxObjects: number | null;
  };
  readonly remoteMedia: Required<RepoConfig> & {
    readonly maxSizeMB: number | null;
  };
  readonly loggers: readonly LogConfig[];

  constructor(public readonly originalConfig: TapirConfigSchema) {
    this.domain = originalConfig.domain ?? DEFAULT_DOMAIN;
    this.port = originalConfig.port ?? DEFAULT_PORT;
    this.url = originalConfig.url ??
      (originalConfig.domain
        ? `${DEFAULT_PROTOCOL}${this.domain}`
        : `http://${DEFAULT_DOMAIN}:${this.port}`);
    this.dataDir = originalConfig.dataDir ?? DEFAULT_DATA_DIR;

    let localDb = originalConfig.localDatabase ?? DEFAULT_LOCAL_DATABASE;
    if (localDb.type === "sqlite") {
      localDb = { path: DEFAULT_LOCAL_SQLITE_PATH, ...localDb };
    }
    this.localDatabase = localDb as Required<DatabaseConfig>;

    let localMedia = originalConfig.localMedia ?? DEFAULT_LOCAL_MEDIA;
    if (localMedia.type === "file") {
      localMedia = { path: DEFAULT_LOCAL_MEDIA_PATH, ...localMedia };
    }
    this.localMedia = localMedia as Required<RepoConfig>;

    let remoteDb = originalConfig.remoteDatabase ?? DEFAULT_REMOTE_DATABASE;
    if (remoteDb.type === "sqlite") {
      remoteDb = { path: DEFAULT_REMOTE_SQLITE_PATH, ...remoteDb };
    }
    this.remoteDatabase = remoteDb as Required<DatabaseConfig> & {
      readonly maxObjects: number | null;
    };

    let remoteMedia = originalConfig.remoteMedia ?? DEFAULT_REMOTE_MEDIA;
    if (remoteMedia.type === "file") {
      remoteMedia = { path: DEFAULT_REMOTE_MEDIA_PATH, ...remoteMedia };
    }
    this.remoteMedia = remoteMedia as Required<RepoConfig> & {
      readonly maxSizeMB: number | null;
    };

    this.loggers = originalConfig.loggers ?? DEFAULT_LOGGERS;

    this.configureGlobalLogger();
  }

  #createLogHandler(config: LogConfig) {
    switch (config.type) {
      case "console":
        return new log.handlers.ConsoleHandler(config.level, {
          formatter: config.json ? JSON.stringify : config.format,
        });
      case "file":
        return new log.handlers.FileHandler(config.level, {
          filename: config.filename,
          mode: config.mode,
          formatter: config.json ? JSON.stringify : config.format,
        });
      case "rotatingFile":
        return new log.handlers.RotatingFileHandler(config.level, {
          filename: config.filename,
          mode: config.mode,
          maxBytes: config.maxBytes,
          maxBackupCount: config.maxBackupCount,
          formatter: config.json ? JSON.stringify : config.format,
        });
    }
  }

  configureGlobalLogger() {
    log.setup({
      handlers: Object.fromEntries(
        this.loggers.map((l, i) => [`handler${i}`, this.#createLogHandler(l)]),
      ),
      loggers: {
        default: {
          handlers: this.loggers.map((_, i) => `handler${i}`),
        },
      },
    });
  }
}

export class TapirConfigFile extends TapirConfig {
  constructor(...filenames: string[]) {
    let json: unknown = undefined;
    for (const filename of filenames) {
      const parser = filename.toLowerCase().endsWith(".json")
        ? JSON.parse
        : toml.parse;
      let file;
      try {
        file = Deno.readTextFileSync(filename);
      } catch {
        continue;
      }
      console.log(`Using Tapir config file at ${filename}`);
      json = parser(file);
      break;
    }
    if (json == null) {
      console.warn(
        `Did not find a Tapir config file (tried ${
          filenames.join(", ")
        }). Using default ${DEFAULT_DOMAIN}:${DEFAULT_PORT} config.`,
      );
      json = {};
    }
    assertTapirConfig(json, "Tapir config file is not valid");
    super(json);
  }
}

@Singleton(TapirConfig)
export class DefaultTapirConfigFile extends TapirConfigFile {
  constructor() {
    super(
      DEFAULT_CONFIG_FILE_TOML,
      DEFAULT_CONFIG_FILE_JSON,
      path.join(DEFAULT_DATA_DIR, DEFAULT_CONFIG_FILE_TOML),
      path.join(DEFAULT_DATA_DIR, DEFAULT_CONFIG_FILE_JSON),
    );
  }
}
