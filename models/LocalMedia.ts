import { log, Status } from "$/deps.ts";
import { LogLevels, Tag } from "$/lib/error.ts";
import { InjectableAbstract, Singleton } from "$/lib/inject.ts";
import { Media } from "$/models/types.ts";
import { LocalDatabaseService } from "$/services/LocalDatabaseService.ts";
import { LocalRepoService } from "$/services/LocalRepoService.ts";

export const MediaNotFound = new Tag("Local Media Not Found", {
  level: LogLevels.WARNING,
  internal: false,
  httpStatus: Status.NotFound,
});

@InjectableAbstract()
export abstract class LocalMediaStore {
  abstract list(): AsyncIterable<string>;

  abstract count(): Promise<number>;

  abstract get(hash: string): Promise<Media>;

  abstract getMeta(hash: string): Promise<Omit<Media, "data">>;

  abstract create(
    data: Uint8Array,
    mimetype: string,
    opts?: { width?: number; height?: number; duration?: number },
  ): Promise<string>;

  abstract delete(hash: string): Promise<void>;
}

@Singleton(LocalMediaStore)
export class LocalMediaStoreImpl extends LocalMediaStore {
  constructor(
    private readonly db: LocalDatabaseService,
    private readonly repo: LocalRepoService,
  ) {
    super();
  }

  async *list() {
    for await (
      const { hash } of this.db.get("media", { returning: ["hash"] })
    ) yield hash;
  }

  count() {
    return this.db.count("media", {});
  }

  async getMeta(hash: string) {
    for await (
      const media of this.db.get("media", { where: { hash }, limit: 1 })
    ) {
      return media;
    }
    throw MediaNotFound.error(`No local media with hash ${hash}`);
  }

  async get(hash: string) {
    const meta = await this.getMeta(hash);
    if (!meta) throw MediaNotFound.error(`No local media with hash ${hash}`);
    const data = await this.repo.get(hash);
    if (!data) {
      log.error(
        `No data in repo for local media item ${hash} (mimetype ${meta.mimetype})! Deleting dangling media entry.`,
      );
      await this.db.delete("media", { hash });
      throw MediaNotFound.error(`No local media with hash ${hash}`);
    }
    return { ...meta, data };
  }

  async create(
    data: Uint8Array,
    mimetype: string,
    opts: { width?: number; height?: number; duration?: number } = {},
  ) {
    const hash = await this.repo.put(data);
    for await (
      const { hash: existing } of this.db.get("media", {
        where: { hash },
        returning: ["hash"],
        limit: 1,
      })
    ) {
      log.info(`Tried to upload duplicate of media with hash ${hash}`);
      return existing;
    }
    await this.db.insert("media", [{
      ...opts,
      hash,
      mimetype,
      bytes: data.byteLength,
      createdAt: new Date(),
    }]);
    return hash;
  }

  async delete(hash: string) {
    await this.repo.delete(hash);
    await this.db.delete("media", { hash });
  }
}
