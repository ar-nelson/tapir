import { Singleton } from "$/lib/inject.ts";
import { chainFrom } from "$/lib/transducers.ts";
import * as urls from "$/lib/urls.ts";
import { InFollowStore } from "$/models/InFollow.ts";
import { KeyStore } from "$/models/Key.ts";
import { LocalAttachmentStore } from "$/models/LocalAttachment.ts";
import { LocalPostStore, PostNotFound } from "$/models/LocalPost.ts";
import { PersonaStore } from "$/models/Persona.ts";
import { TapirConfig } from "$/models/TapirConfig.ts";
import {
  LocalPost,
  ProfileFeed,
  ProfileType,
  Protocol,
  RemotePostFull,
} from "$/models/types.ts";
import {
  FinitePageStream,
  LocalFetcher,
  PageStream,
} from "$/services/RemoteFetcherService.ts";

const PAGE_SIZE = 20;

@Singleton(LocalFetcher)
export class LocalFetcherImpl extends LocalFetcher {
  constructor(
    private readonly config: TapirConfig,
    private readonly personaStore: PersonaStore,
    private readonly keyStore: KeyStore,
    private readonly localPostStore: LocalPostStore,
    private readonly localAttachmentStore: LocalAttachmentStore,
    private readonly inFollowStore: InFollowStore,
  ) {
    super();
  }

  async fetchProfile(profilePath: string) {
    const persona = await this.personaStore.get(profilePath),
      key = await this.keyStore.get(urls.activityPubMainKey(profilePath));
    return {
      addr: { protocol: Protocol.Local, path: profilePath },
      name: persona.name,
      displayName: persona.displayName,
      type: ProfileType.Person,
      canonical: true,
      url: urls.localProfile(profilePath, {}, this.config.url),
      createdAt: persona.createdAt,
      updatedAt: persona.updatedAt,
      summaryHtml: persona.summaryHtml,
      requestToFollow: persona.requestToFollow,
      followerCount: await this.inFollowStore.countFollowers(persona.name),
      followingCount: 0, // TODO: Use OutFollowStore here
      postCount: await this.localPostStore.count(persona.name),
      lastSeen: new Date(),
      proxies: [{
        proxy: {
          protocol: Protocol.ActivityPub,
          path: urls.activityPubActor(profilePath, this.config.url),
        },
        canonical: false,
      }],
      tags: [],
      emoji: [],
      publicKeys: [{
        name: urls.activityPubMainKey(profilePath, this.config.url),
        algorithm: key.algorithm,
        key: key.public!,
      }],
    };
  }

  async fetchFollowers(profilePath: string) {
    // TODO: Better pagination
    return new FinitePageStream(
      async () => ({
        items: await chainFrom(this.inFollowStore.listFollowers(profilePath))
          .map((follow) => follow.remoteProfile)
          .toArray(),
      }),
      await this.inFollowStore.countFollowers(profilePath),
    );
  }

  fetchFollowing() {
    // TODO: Use OutFollowStore here
    return Promise.resolve(FinitePageStream.empty());
  }

  async #localToRemotePost(
    post: LocalPost,
  ): Promise<RemotePostFull> {
    return {
      addr: { protocol: Protocol.Local, path: post.id },
      profile: { protocol: Protocol.Local, path: post.persona },
      instance: this.config.url,
      url: urls.localPost(post.id, {}, this.config.url),
      type: post.type,
      canonical: true,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      viewedAt: post.updatedAt ?? post.createdAt,
      contentHtml: post.contentHtml,
      contentRaw: post.contentRaw,
      contentRawMimetype: post.contentRawMimetype,
      sensitive: !!post.contentWarning,
      contentWarning: post.contentWarning,
      proxies: [{
        proxy: {
          protocol: Protocol.ActivityPub,
          path: urls.activityPubActivity(post.id, this.config.url),
        },
        canonical: false,
      }],
      tags: [], // TODO: Support tags and mentions
      mentions: [],
      emoji: [],
      attachments: await chainFrom(this.localAttachmentStore.list(post.id))
        .map(({ type, original, small, blurhash }) => ({
          type,
          original,
          small,
          blurhash,
          post: { protocol: Protocol.Local, path: post.id },
          originalUrl: urls.localMedia(original, this.config.url),
          smallUrl: small && urls.localMedia(small, this.config.url),
          sensitive: false, // TODO: support sensitive flag on local media
        })).toArray(),
    };
  }

  async fetchProfileFeed(profilePath: string, _feed = ProfileFeed.Posts) {
    // TODO: Support different types of feeds (own posts, replies)
    return new FinitePageStream(
      async (cursor?: string) => {
        const items = await chainFrom(this.localPostStore.list({
          persona: profilePath,
          limit: PAGE_SIZE,
          beforeId: cursor,
        })).mapAsync(this.#localToRemotePost.bind(this)).toArray();
        return {
          nextCursor: items[PAGE_SIZE - 1]?.addr?.path,
          items,
        };
      },
      await this.localPostStore.count(profilePath),
    );
  }

  async fetchPost(postPath: string) {
    const post = await this.localPostStore.get(postPath);
    if (!post) throw PostNotFound.error(`No local post with id ${postPath}`);
    return this.#localToRemotePost(post);
  }

  async fetchReplies(postPath: string) {
    // TODO: Support this
    const post = await this.localPostStore.get(postPath);
    if (!post) throw PostNotFound.error(`No local post with id ${postPath}`);
    return new FinitePageStream(
      async () => ({ items: [await this.#localToRemotePost(post)] }),
      1,
    );
  }

  fetchReactions(_postPath: string) {
    // TODO: Support this
    return Promise.resolve(FinitePageStream.empty());
  }

  fetchBoosts(_postPath: string) {
    // TODO: Support this
    return Promise.resolve(FinitePageStream.empty());
  }

  fetchFeed(_feedPath: string) {
    // TODO: Support named feeds (currently always returns local feed)
    return Promise.resolve(
      new PageStream(
        async (cursor?: string) => {
          const items = await chainFrom(this.localPostStore.list({
            limit: PAGE_SIZE,
            beforeId: cursor,
          })).mapAsync(this.#localToRemotePost.bind(this)).toArray();
          return {
            nextCursor: items[PAGE_SIZE - 1]?.addr?.path,
            items,
          };
        },
      ),
    );
  }
}
