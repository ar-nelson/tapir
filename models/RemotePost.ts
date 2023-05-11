import { log } from "$/deps.ts";
import { Tag } from "$/lib/error.ts";
import { InjectableAbstract, Singleton } from "$/lib/inject.ts";
import { DBLike, Q } from "$/lib/sql/mod.ts";
import { chainFrom, toMap } from "$/lib/transducers.ts";
import { OutgoingRequestBlocked } from "$/models/DomainTrust.ts";
import { ProfileTrustStore } from "$/models/ProfileTrust.ts";
import {
  parseProtoAddr,
  ProtoAddr,
  protoAddrToString,
  RemotePostFull,
  TrustLevel,
} from "$/models/types.ts";
import { RemoteDatabaseTables } from "$/schemas/tapir/db/remote/mod.ts";
import { GarbageCollectorService } from "$/services/GarbageCollectorService.ts";
import { Priority } from "$/services/HttpDispatcher.ts";
import { RemoteDatabaseService } from "$/services/RemoteDatabaseService.ts";
import { RemoteFetcherService } from "$/services/RemoteFetcherService.ts";

export const PostNotFound = new Tag("Remote Post Not Found");

@InjectableAbstract()
export abstract class RemotePostStore {
  abstract get(
    addr: ProtoAddr,
    opts?: {
      refresh?: boolean;
      priority?: Priority;
    },
  ): Promise<RemotePostFull>;

  abstract upsert(post: RemotePostFull, viewed?: boolean): Promise<void>;

  abstract update(
    addr: ProtoAddr,
    data: Partial<Omit<RemotePostFull, "addr">>,
  ): Promise<void>;

  abstract delete(
    addr: ProtoAddr | ProtoAddr[],
    owner?: ProtoAddr,
  ): Promise<void>;
}

@Singleton(RemotePostStore)
export class RemotePostStoreImpl extends RemotePostStore {
  #inflight = new Map<string, Promise<RemotePostFull>>();

  constructor(
    private readonly db: RemoteDatabaseService,
    private readonly gc: GarbageCollectorService,
    private readonly remoteFetcher: RemoteFetcherService,
    private readonly profileTrustStore: ProfileTrustStore,
  ) {
    super();
  }

  async get(
    addr: ProtoAddr,
    { refresh = false, priority }: {
      refresh?: boolean;
      priority?: Priority;
    } = {},
  ): Promise<RemotePostFull> {
    const addrString = protoAddrToString(addr),
      inflight = this.#inflight.get(addrString);
    if (inflight) return inflight;

    const [existing] = await chainFrom(
      this.db.get("post", { where: { addr: addrString }, limit: 1 }),
    ).toArray();
    if (existing && !refresh) {
      const gcMetadata = await this.gc.nextPostMetadata(),
        proxies = await chainFrom(
          this.db.get("postProxy", {
            where: { original: addrString },
            returning: ["proxy", "canonical"],
          }),
        ).map(({ proxy, canonical }) => ({
          proxy: parseProtoAddr(proxy),
          canonical,
        })).toArray();
      await this.db.update("post", { addr: addrString }, { gcMetadata });
      return {
        ...existing,
        updatedAt: existing.updatedAt ?? undefined,
        content: existing.content ?? undefined,
        addr,
        profile: parseProtoAddr(existing.profile),
        targetPost: existing.targetPost == null
          ? undefined
          : parseProtoAddr(existing.targetPost),
        proxies,
        tags: await chainFrom(
          this.db.get("tag", { where: { owner: addrString } }),
        ).toArray(),
        mentions: await chainFrom(
          this.db.get("mention", {
            where: { owner: addrString },
            returning: ["mentioned"],
          }),
        ).map(({ mentioned }) => parseProtoAddr(mentioned)).toArray(),
        emoji: [],
        attachments: await chainFrom(
          this.db.get("attachment", { where: { post: addrString } }),
        ).toArray(),
      };
    }

    const request = (async () => {
      try {
        const fetched = await this.remoteFetcher.fetchPost(addr, priority),
          trust = await this.profileTrustStore.requestToTrust(fetched.profile);
        if (trust <= TrustLevel.BlockUnlessFollow) {
          throw OutgoingRequestBlocked.error(
            `Request to profile ${protoAddrToString(fetched.profile)} blocked`,
          );
        }
        await this.upsert(fetched, true);
        return fetched;
      } catch (e) {
        throw PostNotFound.wrap(e);
      } finally {
        this.#inflight.delete(addrString);
      }
    })();
    this.#inflight.set(addrString, request);
    return request;
  }

  async upsert(
    fullPost: RemotePostFull,
    viewed = false,
  ): Promise<void> {
    const addr = protoAddrToString(fullPost.addr);
    await this.db.transaction(async (txn) => {
      const exists = (await txn.count("post", { addr })) > 0;
      if (!exists) {
        const {
            emoji,
            tags,
            mentions,
            attachments,
            proxies,
            ...post
          } = fullPost,
          postRow = {
            ...post,
            addr,
            profile: protoAddrToString(post.profile),
            targetPost: post.targetPost == null
              ? null
              : protoAddrToString(post.targetPost),
            gcMetadata: viewed ? await this.gc.nextPostMetadata() : 0,
          };
        await txn.insert("post", [postRow]);
        // TODO: Emojis, proxies
        await txn.insert(
          "tag",
          tags.map((t) => ({ ...t, owner: addr, ownerIsPost: true })),
        );
        await txn.insert(
          "mention",
          mentions.map((m) => ({
            owner: addr,
            ownerIsPost: true,
            mentioned: protoAddrToString(m),
          })),
        );
        await txn.insert(
          "attachment",
          attachments.map((a) => ({ ...a, post: addr })),
        );
        return;
      }
      await this.#update(addr, fullPost, viewed, txn);
    });
  }

  async update(
    addr: ProtoAddr,
    data: Partial<Omit<RemotePostFull, "addr">>,
  ) {
    const addrString = protoAddrToString(addr);
    await this.db.transaction(async (txn) => {
      if ((await txn.count("post", { addr: addrString })) < 1) {
        throw PostNotFound.error(
          `Cannot update nonexistent post ${addrString}`,
        );
      }
      await this.#update(addrString, data, false, txn);
    });
  }

  async #update(
    addr: string,
    { emoji, tags, mentions, attachments, proxies, addr: _addr, ...post }:
      Partial<RemotePostFull>,
    viewed: boolean,
    txn: DBLike<RemoteDatabaseTables>,
  ) {
    const postRow = {
      ...post,
      gcMetadata: viewed ? await this.gc.nextPostMetadata() : undefined,
      profile: post.profile == null
        ? post.profile
        : protoAddrToString(post.profile),
      targetPost: post.targetPost == null
        ? post.targetPost
        : protoAddrToString(post.targetPost),
    };
    await txn.update("post", { addr }, postRow);
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
          await txn.insert("tag", [{ ...tag, owner: addr, ownerIsPost: true }]);
        } else await txn.update("tag", { id }, tag);
      }
    }
    if (mentions) {
      await txn.delete("mention", {
        owner: addr,
        ownerIsPost: true,
        mentioned: Q.notIn(mentions.map(protoAddrToString)),
      });
      const existingMentions = await chainFrom(
        txn.get("mention", {
          where: { owner: addr },
          returning: ["mentioned"],
        }),
      ).map(({ mentioned }) => mentioned).toSet();
      const newMentions = mentions.map(protoAddrToString).filter((m) =>
        !existingMentions.has(m)
      );
      await txn.insert(
        "mention",
        newMentions.map((m) => ({
          owner: addr,
          ownerIsPost: true,
          mentioned: m,
        })),
      );
    }
    if (attachments) {
      await txn.delete("attachment", {
        post: addr,
        originalUrl: Q.notIn(attachments.map((a) => a.originalUrl)),
      });
      const existingAttachments = await chainFrom(
        txn.get("attachment", {
          where: { post: addr },
          returning: ["id", "originalUrl"],
        }),
      ).map(({ id, originalUrl }) => [originalUrl, id] as const).collect(
        toMap(),
      );
      for (const attachment of attachments) {
        const id = existingAttachments.get(attachment.originalUrl);
        if (id == null) {
          await txn.insert("attachment", [{ ...attachment, post: addr }]);
        } else await txn.update("attachment", { id }, attachment);
      }
    }
  }

  async delete(addr: ProtoAddr | ProtoAddr[], owner?: ProtoAddr) {
    const query = Array.isArray(addr)
      ? Q.in(addr.map(protoAddrToString))
      : protoAddrToString(addr);
    await this.db.transaction(async (txn) => {
      if (owner) {
        const existing = await chainFrom(
          txn.get("post", { where: { addr: query } }),
        ).toArray();
        if (!existing.length) return;
        const profile = protoAddrToString(owner),
          mismatch = existing.find((p) => p.profile !== profile);
        if (mismatch) {
          log.warning(
            `Cannot delete remote post ${mismatch.addr} as remote profile ${profile}: post not owned by the profile requesting deletion`,
          );
          return;
        }
      }
      await txn.delete("tag", { owner: query });
      await txn.delete("mention", { owner: query });
      await txn.delete("attachment", { post: query });
      await txn.delete("post", { addr: query });
    });
  }
}
