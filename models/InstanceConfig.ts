import { log, timingSafeEqual } from "$/deps.ts";
import { InjectableAbstract, Singleton } from "$/lib/inject.ts";
import { hashPassword } from "$/lib/utils.ts";
import { LocalDatabaseService } from "$/services/LocalDatabaseService.ts";

export interface InstanceConfig {
  readonly initialized: boolean;
  readonly displayName: string;
  readonly summary: string;
  readonly adminEmail: string;
  readonly loginName: string;
  readonly maxCharacters: number;
  readonly maxMediaAttachments: number;
  readonly maxImageBytes: number;
  readonly maxImagePixels: number;
  readonly maxVideoBytes: number;
  readonly maxVideoPixels: number;
  readonly maxVideoFramerate: number;
  readonly passwordHash: Uint8Array;
  readonly passwordSalt: Uint8Array;
  readonly mediaSalt: Uint8Array;
  readonly locale: string;
  readonly logo?: string | null;
  readonly updatedAt: Date;
}

@InjectableAbstract()
export abstract class InstanceConfigStore {
  abstract get(): Promise<InstanceConfig>;
  abstract update(
    patch: Partial<Omit<InstanceConfig, "initialized" | "updatedAt">>,
  ): Promise<void>;
  abstract setPassword(newPassword: string): Promise<void>;
  abstract checkPassword(password: string): Promise<boolean>;
}

@Singleton(InstanceConfigStore)
export class InstanceConfigStoreImpl extends InstanceConfigStore {
  #config: Promise<InstanceConfig>;

  constructor(private readonly db: LocalDatabaseService) {
    super();

    this.#config = (async () => {
      for await (
        const entry of db.get("instanceConfig", {
          where: { key: true },
          limit: 1,
        })
      ) {
        return { ...entry, initialized: true };
      }

      return {
        initialized: false,
        displayName: "New Tapir Server",
        summary: "Configuring a new Tapir server",
        loginName: "tapir",
        adminEmail: "admin@example.com",
        maxCharacters: 65536,
        maxMediaAttachments: 32,
        maxImageBytes: 1024 * 1024 * 16,
        maxImagePixels: 3840 * 2160,
        maxVideoBytes: 1024 * 1024 * 256,
        maxVideoPixels: 1920 * 1080,
        maxVideoFramerate: 60,
        passwordHash: new Uint8Array(0),
        passwordSalt: crypto.getRandomValues(new Uint8Array(16)),
        mediaSalt: crypto.getRandomValues(new Uint8Array(16)),
        locale: "en-US",
        updatedAt: new Date(),
      };
    })();
  }

  get() {
    return this.#config;
  }

  async update(
    patch: Partial<Omit<InstanceConfig, "initialized" | "updatedAt">>,
  ) {
    const lastConfigPromise = this.#config;
    await (this.#config = (async () => {
      const { initialized, ...last } = await lastConfigPromise,
        update = { ...patch, updatedAt: new Date() };
      try {
        if (initialized) {
          await this.db.update("instanceConfig", { key: true }, update);
        } else {
          await this.db.insert("instanceConfig", [{
            ...last,
            ...update,
            key: true,
          }]);
        }
      } catch (e) {
        log.error(e);
        return { ...last, initialized };
      }
      return { ...last, ...update, initialized: true };
    })());
  }

  async setPassword(newPassword: string): Promise<void> {
    const lastConfigPromise = this.#config;
    await (this.#config = (async () => {
      const { initialized, ...last } = await lastConfigPromise,
        hash = hashPassword(newPassword, last.passwordSalt),
        update = { passwordHash: hash, updatedAt: new Date() };
      try {
        await this.db.update("instanceConfig", { key: true }, update);
      } catch (e) {
        log.error(e);
        return { ...last, initialized };
      }
      return { ...last, ...update, initialized: true };
    })());
  }

  async checkPassword(password: string): Promise<boolean> {
    const { passwordHash, passwordSalt } = await this.#config;
    return timingSafeEqual(passwordHash, hashPassword(password, passwordSalt));
  }
}
