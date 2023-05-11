import { InjectableAbstract, Singleton } from "$/lib/inject.ts";
import { Q } from "$/lib/sql/mod.ts";
import { chainFrom } from "$/lib/transducers.ts";
import { RemoteMediaStore } from "$/models/RemoteMedia.ts";
import { TapirConfig } from "$/models/TapirConfig.ts";
import { BackgroundTaskService } from "$/services/BackgroundTaskService.ts";
import { RemoteDatabaseService } from "$/services/RemoteDatabaseService.ts";

@InjectableAbstract()
export abstract class GarbageCollectorService {
  abstract incrementCount(): Promise<void>;
  abstract nextPostMetadata(): Promise<number>;
  abstract nextProfileMetadata(): Promise<number>;
  abstract collect(): Promise<void>;
}

export class NoOpGarbageCollectorService extends GarbageCollectorService {
  incrementCount() {
    return Promise.resolve();
  }
  nextPostMetadata() {
    return Promise.resolve(0);
  }
  nextProfileMetadata() {
    return Promise.resolve(0);
  }
  collect() {
    return Promise.resolve();
  }
}

// TODO: More sophisticated garbage collection algorithm
@Singleton(GarbageCollectorService)
export class LruGarbageCollectorService extends GarbageCollectorService {
  #state: Promise<{ nextLamport: number; count: number }>;
  #maxObjects: number;
  #collecting = false;

  constructor(
    { remoteDatabase: { maxObjects } }: TapirConfig,
    private readonly db: RemoteDatabaseService,
    private readonly media: RemoteMediaStore,
    private readonly backgroundTaskService: BackgroundTaskService,
  ) {
    super();
    this.#maxObjects = maxObjects ?? 65536;
    this.#state = (async () => {
      const [maxPostLamport] = await chainFrom(
          db.get("post", {
            orderBy: [["gcMetadata", "DESC"]],
            limit: 1,
            returning: ["gcMetadata"],
          }),
        ).map(({ gcMetadata }) => gcMetadata).toArray(),
        [maxProfileLamport] = await chainFrom(
          db.get("profile", {
            orderBy: [["gcMetadata", "DESC"]],
            limit: 1,
            returning: ["gcMetadata"],
          }),
        ).map(({ gcMetadata }) => gcMetadata).toArray(),
        postCount = await db.count("post", {}),
        profileCount = await db.count("profile", {});
      return {
        nextLamport: Math.max(maxPostLamport ?? 0, maxProfileLamport ?? 0) + 1,
        count: postCount + profileCount,
      };
    })();
  }

  async incrementCount() {
    const st = await this.#state;
    if (++st.count >= this.#maxObjects && !this.#collecting) {
      this.backgroundTaskService.watch(
        this.collect(),
        "Remote database garbage collection",
      );
    }
  }

  async nextPostMetadata() {
    const st = await this.#state;
    return ++st.nextLamport;
  }

  async nextProfileMetadata() {
    const st = await this.#state;
    return ++st.nextLamport;
  }

  async collect() {
    this.#collecting = true;
    try {
      await this.db.transaction(async (txn) => {
        const toCollect = Math.floor(this.#maxObjects * 0.25),
          oldestPosts = await chainFrom(
            txn.get("post", {
              orderBy: [["gcMetadata", "ASC"]],
              limit: toCollect,
              returning: ["addr", "gcMetadata"],
            }),
          ).map((p) => ({ ...p, post: true })).toArray(),
          oldestProfiles = await chainFrom(
            txn.get("profile", {
              orderBy: [["gcMetadata", "ASC"]],
              limit: toCollect,
              returning: ["addr", "gcMetadata"],
            }),
          ).map((p) => ({ ...p, post: false })).toArray(),
          toDelete = chainFrom(
            [...oldestPosts, ...oldestProfiles].sort((a, b) =>
              a.gcMetadata - b.gcMetadata
            ),
          ).take(toCollect).toPartitionMap((p) => p.post),
          posts = toDelete.get(true) ?? [],
          profiles = toDelete.get(false) ?? [],
          postAddrs = posts.map((p) => p.addr),
          profileAddrs = profiles.map((p) => p.addr),
          postMedia = await chainFrom(
            txn.get("attachment", {
              where: { post: Q.in(postAddrs) },
              returning: ["original", "small"],
            }),
          ).flatMap(({ original, small }) => [original, small]).notNull()
            .toSet(),
          profileMedia = await chainFrom(
            txn.get("profile", {
              where: { addr: Q.in(profileAddrs) },
              returning: ["avatar", "banner"],
            }),
          ).flatMap(({ avatar, banner }) => [avatar, banner]).notNull().toSet(),
          media = new Set([...postMedia, ...profileMedia]);
        await this.media.delete(media);
        await txn.delete("attachment", { post: Q.in(postAddrs) });
        await txn.delete("mention", { owner: Q.in(postAddrs) });
        await txn.delete("tag", {
          owner: Q.in([...postAddrs, ...profileAddrs]),
        });
        await txn.delete("post", { addr: Q.in(postAddrs) });
        await txn.delete("profile", { addr: Q.in(profileAddrs) });
        const st = await this.#state;
        st.count -= posts.length + profiles.length;
      });
    } finally {
      this.#collecting = false;
    }
  }
}
