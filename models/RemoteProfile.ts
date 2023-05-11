import { log, Status } from "$/deps.ts";
import { DateDiff, datetime } from "$/lib/datetime/mod.ts";
import { Tag } from "$/lib/error.ts";
import { InjectableAbstract, Singleton } from "$/lib/inject.ts";
import { DBLike, Q } from "$/lib/sql/mod.ts";
import { chainFrom, toMap } from "$/lib/transducers.ts";
import { OutgoingRequestBlocked } from "$/models/DomainTrust.ts";
import { ProfileTrustStore } from "$/models/ProfileTrust.ts";
import {
  parseProtoAddr,
  ProfileType,
  ProtoAddr,
  protoAddrToString,
  RemoteProfileFull,
  TrustLevel,
} from "$/models/types.ts";
import { RemoteDatabaseTables } from "$/schemas/tapir/db/remote/mod.ts";
import { GarbageCollectorService } from "$/services/GarbageCollectorService.ts";
import { Priority } from "$/services/HttpDispatcher.ts";
import { RemoteDatabaseService } from "$/services/RemoteDatabaseService.ts";
import { RemoteFetcherService } from "$/services/RemoteFetcherService.ts";

const MASTODON_PATH_REGEX =
  /^\@?([a-z0-9_]+)\@((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9])$/i;

export const ProfileNotFound = new Tag("Remote Profile Not Found", {
  httpStatus: Status.NotFound,
});

const EXPIRATION: DateDiff = { day: 1 };

@InjectableAbstract()
export abstract class RemoteProfileStore {
  abstract get(
    addr: ProtoAddr,
    opts?: {
      refresh?: boolean;
      priority?: Priority;
    },
  ): Promise<RemoteProfileFull>;

  abstract upsert(profile: RemoteProfileFull, viewed?: boolean): Promise<void>;

  abstract update(
    addr: ProtoAddr,
    data: Partial<Omit<RemoteProfileFull, "addr" | "lastSeen">>,
  ): Promise<void>;

  abstract delete(addr: ProtoAddr | string[]): Promise<void>;
}

@Singleton(RemoteProfileStore)
export class RemoteProfileStoreImpl extends RemoteProfileStore {
  #inflight = new Map<string, Promise<RemoteProfileFull>>();

  constructor(
    private readonly profileTrustStore: ProfileTrustStore,
    private readonly remoteFetcher: RemoteFetcherService,
    private readonly gc: GarbageCollectorService,
    private readonly db: RemoteDatabaseService,
  ) {
    super();
  }

  async get(
    addr: ProtoAddr,
    { refresh, priority }: {
      refresh?: boolean;
      priority?: Priority;
    } = {},
  ): Promise<RemoteProfileFull> {
    const addrString = protoAddrToString(addr),
      inflight = this.#inflight.get(addrString);
    if (inflight) return inflight;

    const [existing] = await chainFrom(
      this.db.get("profile", { where: { addr: addrString }, limit: 1 }),
    ).toArray();
    if (existing && !refresh) {
      if (datetime(existing.lastSeen).add(EXPIRATION).isAfter(datetime())) {
        const gcMetadata = await this.gc.nextProfileMetadata(),
          proxies = await chainFrom(
            this.db.get("profileProxy", {
              where: { original: addrString },
              returning: ["proxy", "canonical"],
            }),
          ).map(({ proxy, canonical }) => ({
            proxy: parseProtoAddr(proxy),
            canonical,
          })).toArray();
        this.db.update("profile", { addr: addrString }, { gcMetadata });
        return {
          ...existing,
          displayName: existing.displayName ?? undefined,
          createdAt: existing.createdAt ?? undefined,
          updatedAt: existing.updatedAt ?? undefined,
          addr,
          type: existing.type as ProfileType,
          proxies,
          tags: await chainFrom(
            this.db.get("tag", { where: { owner: addrString } }),
          ).toArray(),
          publicKeys: await chainFrom(
            this.db.get("publicKey", { where: { owner: addrString } }),
          ).toArray(),
          emoji: [],
        };
      } else {
        log.info(
          `Profile metadata for ${addrString} is stale; re-fetching profile`,
        );
      }
    }

    const request = (async () => {
      try {
        const trust = await this.profileTrustStore.requestToTrust(addr);
        if (trust <= TrustLevel.BlockUnlessFollow) {
          throw OutgoingRequestBlocked.error(
            `Request to profile ${addrString} blocked`,
          );
        }
        const fetched = await this.remoteFetcher.fetchProfile(addr, priority);
        await this.upsert(fetched, true);
        return fetched;
      } catch (e) {
        throw ProfileNotFound.wrap(e);
      } finally {
        this.#inflight.delete(addrString);
      }
    })();
    this.#inflight.set(addrString, request);
    return request;
  }

  async upsert(fullProfile: RemoteProfileFull, viewed = false) {
    const addr = protoAddrToString(fullProfile.addr);
    await this.db.transaction(async (txn) => {
      const exists = (await txn.count("profile", { addr })) > 0;
      if (!exists) {
        const {
            emoji,
            tags,
            publicKeys,
            proxies,
            ...profile
          } = fullProfile,
          profileRow = {
            ...profile,
            addr,
            lastSeen: new Date(),
            gcMetadata: viewed ? await this.gc.nextProfileMetadata() : 0,
          };
        await txn.insert("profile", [profileRow]);
        // TODO: Emojis, proxies
        await txn.insert(
          "tag",
          tags.map((t) => ({ ...t, owner: addr, ownerIsPost: false })),
        );
        await txn.insert(
          "publicKey",
          publicKeys.map((a) => ({ ...a, owner: addr })),
        );
        return;
      }
      await this.#update(addr, fullProfile, viewed, txn);
    });
  }

  async update(
    addr: ProtoAddr,
    data: Partial<Omit<RemoteProfileFull, "addr" | "lastSeen">>,
  ) {
    const addrString = protoAddrToString(addr);
    await this.db.transaction(async (txn) => {
      if ((await txn.count("profile", { addr: addrString })) < 1) {
        throw ProfileNotFound.error(
          `Cannot update nonexistent profile ${addrString}`,
        );
      }
      await this.#update(addrString, data, false, txn);
    });
  }

  async #update(
    addr: string,
    { emoji, tags, publicKeys, proxies, addr: _addr, ...profile }: Partial<
      RemoteProfileFull
    >,
    viewed: boolean,
    txn: DBLike<RemoteDatabaseTables>,
  ) {
    const profileRow = {
      ...profile,
      gcMetadata: viewed ? await this.gc.nextPostMetadata() : undefined,
      lastSeen: new Date(),
    };
    await txn.update("profile", { addr }, profileRow);
    if (tags) {
      await txn.delete("tag", {
        owner: addr,
        tag: Q.notIn(tags.map((t) => t.tag)),
      });
      const existingTags = await chainFrom(
        txn.get("tag", { where: { owner: addr }, returning: ["id", "tag"] }),
      ).map(({ id, tag }) => [tag, id] as const).collect(toMap());
      for (const tag of tags) {
        const id = existingTags.get(tag.tag);
        if (id == null) {
          await txn.insert("tag", [{
            ...tag,
            owner: addr,
            ownerIsPost: false,
          }]);
        } else await txn.update("tag", { id }, tag);
      }
    }
    if (publicKeys) {
      await txn.delete("publicKey", {
        owner: addr,
        name: Q.notIn(publicKeys.map((a) => a.name)),
      });
      const existingKeys = await chainFrom(
        txn.get("publicKey", {
          where: { owner: addr },
          returning: ["name"],
        }),
      ).map(({ name }) => name).toSet();
      for (const key of publicKeys) {
        if (existingKeys.has(key.name)) {
          await txn.update("publicKey", { name }, key);
        } else {
          await txn.insert("publicKey", [{ ...key, owner: addr }]);
        }
      }
    }
  }

  async delete(addr: ProtoAddr | string[]) {
    if (Array.isArray(addr)) {
      await this.db.delete("profile", { addr: Q.in(addr) });
    } else {
      const key = protoAddrToString(addr);
      await this.#inflight.get(key) ?? Promise.resolve();
      await this.db.delete("profile", { addr: key });
    }
  }
}
