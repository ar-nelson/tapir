import { log } from "$/deps.ts";
import { LfuCache } from "$/lib/cache.ts";
import { Tag } from "$/lib/error.ts";
import { InjectableAbstract, Singleton } from "$/lib/inject.ts";
import { Q } from "$/lib/sql/mod.ts";
import { chainFrom } from "$/lib/transducers.ts";
import { isSubdomainOf, normalizeDomain } from "$/lib/urls.ts";
import { DomainTrustStore, MediaBlocked } from "$/models/DomainTrust.ts";
import { TapirConfig } from "$/models/TapirConfig.ts";
import {
  ProtoAddr,
  RemoteAttachment,
  RemoteMedia,
  TrustLevel,
} from "$/models/types.ts";
import { Priority } from "$/services/HttpDispatcher.ts";
import { MediaProcessorService } from "$/services/MediaProcessorService.ts";
import { RemoteDatabaseService } from "$/services/RemoteDatabaseService.ts";
import { RemoteRepoService } from "$/services/RemoteRepoService.ts";

export const MediaNotFound = new Tag("Remote Media Not Found");

@InjectableAbstract()
export abstract class RemoteMediaStore {
  abstract list(): AsyncIterable<string>;

  abstract count(): Promise<number>;

  abstract get(hash: string): Promise<RemoteMedia>;

  abstract getByUrl(
    url: URL,
    opts?: {
      owner?: ProtoAddr;
      mimetype?: string;
      priority?: Priority;
      overrideTrust?: boolean;
    },
  ): Promise<RemoteMedia>;

  abstract getMeta(hash: string): Promise<Omit<RemoteMedia, "data">>;

  abstract getAttachmentOriginal(
    attachment: RemoteAttachment,
    opts?: {
      owner?: ProtoAddr;
      mimetype?: string;
      priority?: Priority;
      overrideTrust?: boolean;
    },
  ): Promise<RemoteMedia>;

  abstract create(
    data: Uint8Array,
    mimetype: string,
    opts?: { width?: number; height?: number; duration?: number },
  ): Promise<string>;

  abstract delete(hash: string | Iterable<string>): Promise<void>;

  abstract purgeDomain(domain: string): Promise<void>;
}

@Singleton(RemoteMediaStore)
export class RemoteMediaStoreImpl extends RemoteMediaStore {
  #cache: LfuCache<string, number> | undefined;

  constructor(
    { remoteMedia: { maxSizeMB } }: TapirConfig,
    private readonly db: RemoteDatabaseService,
    private readonly repo: RemoteRepoService,
    private readonly mediaProcessor: MediaProcessorService,
    private readonly domainTrust: DomainTrustStore,
  ) {
    super();
    if (maxSizeMB) {
      const maxTotalSize = maxSizeMB * 1024 * 1024;
      this.#cache = new LfuCache<string, number>({
        dynamicAging: true,
        computeSize: (x) => x,
        maxTotalSize,
        preferredTotalSize: Math.floor(maxTotalSize * 0.75),
        onEvict: (k) => this.delete(k, false),
      });
    }
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
    throw MediaNotFound.error(`No remote media with hash ${hash}`);
  }

  async getAttachmentOriginal(attachment: RemoteAttachment, opts: {
    owner?: ProtoAddr;
    mimetype?: string;
    priority?: Priority;
    overrideTrust?: boolean;
  } = {}) {
    const fetched = await this.#get({
      hash: attachment.original ?? undefined,
      url: attachment.originalUrl,
    }, opts);
    if (fetched.hash !== attachment.original) {
      await this.db.update("attachment", {
        originalUrl: attachment.originalUrl,
      }, { original: fetched.hash });
    }
    return fetched;
  }

  async #get(
    where: { hash?: string; url?: string },
    opts: {
      owner?: ProtoAddr;
      mimetype?: string;
      priority?: Priority;
      overrideTrust?: boolean;
    },
  ): Promise<RemoteMedia> {
    let toFetch = where.url, mimetype = opts.mimetype;
    const media = await this.db.transaction(async (txn) => {
      for await (
        const media of txn.get("media", { where, limit: 1 })
      ) {
        const data = await this.repo.get(media.hash);
        if (data && (!opts.mimetype || media.mimetype === opts.mimetype)) {
          return {
            ...media,
            data,
          };
        } else {
          log.info(
            `No data in repo for remote media item ${media.hash} (mimetype ${media.mimetype}), attempting to refetch.`,
          );
          toFetch = media.url ?? undefined;
          mimetype = mimetype ?? media.mimetype;
        }
      }
      if (!toFetch) {
        if (where.hash) await txn.delete("media", where);
        return MediaNotFound.error(`No remote media with hash ${where.hash}`);
      }
      const url = new URL(toFetch);
      if (
        (await this.domainTrust.mediaTrust(url)) <=
          (opts.overrideTrust
            ? TrustLevel.BlockUnconditional
            : TrustLevel.BlockUnlessFollow)
      ) {
        return MediaBlocked.error(`Blocked media from ${url.hostname}`);
      }
      try {
        const { original } = await this.mediaProcessor.fetchMedia(url, {
            mimetype,
            owner: opts.owner,
            priority: opts.priority,
          }),
          hash = await this.repo.put(original.data),
          media = {
            hash,
            domain: normalizeDomain(url.hostname),
            url: url.href,
            mimetype: original.mimetype,
            bytes: original.data.byteLength,
            width: original.width,
            height: original.height,
            createdAt: new Date(),
          };
        await txn.insert("media", [media]);
        this.#cache?.insert(hash, original.data.byteLength, 1);
        return { ...media, data: original.data };
      } catch (e) {
        return MediaNotFound.wrap(e);
      }
    });
    if (media instanceof Error) throw media;
    return media;
  }

  get(hash: string) {
    return this.#get({ hash }, {});
  }

  getByUrl(
    url: URL,
    opts: {
      owner?: ProtoAddr;
      mimetype?: string;
      priority?: Priority;
      overrideTrust?: boolean;
    } = {},
  ): Promise<RemoteMedia> {
    return this.#get({ url: url.href }, opts);
  }

  async create(
    data: Uint8Array,
    mimetype: string,
    opts: {
      domain?: string;
      width?: number;
      height?: number;
      duration?: number;
    } = {},
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
      domain: opts.domain == null ? undefined : normalizeDomain(opts.domain),
      hash,
      mimetype,
      bytes: data.byteLength,
      createdAt: new Date(),
    }]);
    this.#cache?.insert(hash, data.byteLength, 1);
    return hash;
  }

  async delete(hash: string | Iterable<string>, removeFromCache = true) {
    const hashes = typeof hash === "string" ? [hash] : hash;
    for (const hash of hashes) {
      if (removeFromCache) this.#cache?.delete(hash);
      await this.repo.delete(hash);
    }
    await this.db.delete("media", { hash: Q.in([...hashes]) });
  }

  async purgeDomain(domain: string): Promise<void> {
    domain = normalizeDomain(domain);
    for (
      const { hash } of await chainFrom(
        this.db.get("media", {
          where: { domain: Q.like(`%${domain}`) },
          returning: ["hash", "domain"],
        }),
      ).filter((e) => e.domain != null && isSubdomainOf(domain, e.domain))
        .toArray()
    ) {
      await this.delete(hash);
    }
  }
}
