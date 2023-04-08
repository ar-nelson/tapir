import { firstRunSetup } from "$/lib/firstRunSetup.ts";
import {
  DEFAULT_LOCAL_MEDIA_PATH,
  DEFAULT_LOCAL_SQLITE_PATH,
  DEFAULT_LOGGERS,
  DEFAULT_REMOTE_MEDIA_PATH,
  DEFAULT_REMOTE_SQLITE_PATH,
} from "$/models/TapirConfig.ts";
import { TapirConfig } from "$/schemas/tapir/TapirConfig.ts";

export class FirstRunController {
  constructor(
    private readonly config: TapirConfig,
    private readonly abort: AbortController,
  ) {}

  setup(): Promise<TapirConfig> {
    return Promise.resolve(this.config);
  }

  async submitSetup(form: URLSearchParams): Promise<Required<TapirConfig>> {
    const expect = (key: string): string => {
      if (form.has(key)) return form.get(key)!;
      throw new Error(`Missing required parameter ${JSON.stringify(key)}`);
    };
    const password = expect("password"),
      confirm = expect("confirmPassword");
    if (password !== confirm) {
      throw new Error("Passwords do not match");
    }
    const maxObjects = +expect("remoteDatabaseMaxObjects"),
      maxSizeMB = +expect("remoteRepoMaxSizeMB"),
      config: Required<TapirConfig> = {
        domain: expect("domain"),
        url: expect("url"),
        dataDir: expect("dataDir"),
        port: +expect("port"),
        localDatabase: expect("localDatabaseType") === "sqlite"
          ? { type: "sqlite", path: DEFAULT_LOCAL_SQLITE_PATH }
          : { type: "inmemory" },
        localMedia: expect("localRepoType") === "file"
          ? { type: "file", path: DEFAULT_LOCAL_MEDIA_PATH }
          : { type: "inmemory" },
        remoteDatabase: expect("remoteDatabaseType") === "sqlite"
          ? { type: "sqlite", path: DEFAULT_REMOTE_SQLITE_PATH, maxObjects }
          : { type: "inmemory", maxObjects },
        remoteMedia: expect("remoteRepoType") === "file"
          ? { type: "file", path: DEFAULT_REMOTE_MEDIA_PATH, maxSizeMB }
          : { type: "inmemory", maxSizeMB },
        loggers: this.config.loggers ?? DEFAULT_LOGGERS,
        instance: {
          displayName: expect("displayName"),
          summary: expect("summary"),
          adminEmail: expect("adminEmail"),
        },
        auth: {
          type: "password",
          username: expect("loginName"),
          password,
        },
        mainPersona: {
          name: expect("mainPersonaName"),
          displayName: expect("mainPersonaDisplayName"),
          summary: expect("mainPersonaSummary"),
          requestToFollow: !!form.get("mainPersonaRequestToFollow"),
        },
      };
    await firstRunSetup(config);
    this.abort.abort("first-run setup complete");
    return config;
  }
}
