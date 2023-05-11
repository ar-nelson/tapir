import { datetime } from "$/lib/datetime/datetime.ts";
import { DEFAULT_SOFTWARE_FEATURES } from "$/lib/softwareFeatures.ts";
import { chainFrom } from "$/lib/transducers.ts";
import * as urls from "$/lib/urls.ts";
import { ProfileTrustStore } from "$/models/ProfileTrust.ts";
import {
  InstanceNotFound,
  RemoteInstanceStore,
} from "$/models/RemoteInstance.ts";
import { RemoteMediaStore } from "$/models/RemoteMedia.ts";
import { RemotePostStore } from "$/models/RemotePost.ts";
import { RemoteProfileStore } from "$/models/RemoteProfile.ts";
import { TapirConfig } from "$/models/TapirConfig.ts";
import {
  PostType,
  ProfileFeed,
  ProtoAddr,
  protoAddrToString,
  Protocol,
  RemotePostFull,
  RemoteProfileFull,
  TrustLevel,
} from "$/models/types.ts";
import { Priority } from "$/services/HttpDispatcher.ts";
import {
  PageStream,
  RemoteFetcherService,
} from "$/services/RemoteFetcherService.ts";
import {
  InstanceDetail,
  PostDetail,
  ProfileCardDetail,
  ProfileDetail,
  ReactionDetail,
} from "$/views/types.ts";
import { InFollowStore } from "../models/InFollow.ts";

export abstract class RemoteBrowserService {
  abstract instance(url: URL): Promise<InstanceDetail>;
  abstract instanceUsers(
    url: URL,
  ): Promise<
    { instance: InstanceDetail; pages: PageStream<ProfileCardDetail> }
  >;
  abstract remoteFeed(
    feed: ProtoAddr,
  ): Promise<{ instance: InstanceDetail; pages: PageStream<PostDetail> }>;
  abstract profileCard(profile: ProtoAddr): Promise<ProfileCardDetail>;
  abstract profile(profile: ProtoAddr): Promise<ProfileDetail>;
  abstract profileFeed(
    profile: ProtoAddr,
    feed: ProfileFeed,
  ): Promise<{ profile: ProfileDetail; pages: PageStream<PostDetail> }>;
  abstract profileFollowers(
    profile: ProtoAddr,
  ): Promise<{ profile: ProfileDetail; pages: PageStream<ProfileCardDetail> }>;
  abstract profileFollowing(
    profile: ProtoAddr,
  ): Promise<{ profile: ProfileDetail; pages: PageStream<ProfileCardDetail> }>;
  abstract post(post: ProtoAddr): Promise<PostDetail>;
  abstract postThread(post: ProtoAddr): Promise<PageStream<PostDetail>>;
  abstract postReactions(
    post: ProtoAddr,
  ): Promise<{ post: PostDetail; pages: PageStream<ReactionDetail> }>;
  abstract postBoosts(
    post: ProtoAddr,
  ): Promise<{ post: PostDetail; pages: PageStream<ProfileCardDetail> }>;
}

export class RemoteBrowserServiceImpl extends RemoteBrowserService {
  constructor(
    private readonly config: TapirConfig,
    private readonly profileTrustStore: ProfileTrustStore,
    private readonly inFollowStore: InFollowStore,
    private readonly remoteInstanceStore: RemoteInstanceStore,
    private readonly remoteProfileStore: RemoteProfileStore,
    private readonly remotePostStore: RemotePostStore,
    private readonly remoteMediaStore: RemoteMediaStore,
    private readonly remoteFetcher: RemoteFetcherService,
  ) {
    super();
  }

  async instance(url: URL): Promise<InstanceDetail> {
    const instance = await this.remoteInstanceStore.get(
      url,
      true,
      Priority.Immediate,
    );
    return {
      url: new URL(instance.url),
      protocols: instance.instanceMetadata.protocols,
      displayName: instance.displayName ?? undefined,
      shortDescription: instance.shortDescription ?? undefined,
      description: instance.description ?? undefined,
      logoUrl: instance.logoUrl ?? undefined,
      software: instance.software ?? undefined,
      softwareVersion: instance.softwareVersion ?? undefined,
      adminEmail: instance.instanceMetadata.adminEmail,
      rules: instance.instanceMetadata.rules,
      links: instance.instanceMetadata.links,
      stats: instance.instanceMetadata.stats ?? {},
      feeds: instance.instanceMetadata.feeds ?? [],
      admins: await chainFrom(instance.instanceMetadata.admins ?? []).mapAsync(
        this.profileCard.bind(this),
      ).toArray(),
      features: instance.instanceMetadata.features,
    };
  }

  async instanceUsers(url: URL): Promise<
    { instance: InstanceDetail; pages: PageStream<ProfileCardDetail> }
  > {
    throw new Error("Not yet implemented");
  }

  async #postToDetail(
    post: RemotePostFull,
    instance?: InstanceDetail,
  ): Promise<PostDetail> {
    const features = instance?.features ??
      DEFAULT_SOFTWARE_FEATURES.features[0].flags;
    return {
      addr: post.addr,
      proxies: post.proxies,
      canonical: post.canonical,
      author: await this.profileCard(post.profile),
      url: post.url ?? undefined,
      type: post.type,
      createdAt: datetime(post.createdAt),
      updatedAt: (post.updatedAt && datetime(post.updatedAt)) ?? undefined,
      content: post.content ?? undefined,
      contentWarning: post.sensitive
        ? (post.contentWarning ?? "Sensitive content")
        : undefined,
      replyTo: post.type === PostType.Reply && post.targetPost || undefined,
      boost: post.type === PostType.Boost && post.targetPost &&
          (await this.post(post.targetPost)) || undefined,
      tags: post.tags,
      mentions: post.mentions,
      attachments: await chainFrom(post.attachments).mapAsync(async (a) => ({
        url: a.original
          ? urls.remoteMedia(a.original)
          : ((a.sensitive || post.sensitive)
            ? urls.remoteMediaPreload(a.originalUrl)
            : urls.remoteMedia(
              (await this.remoteMediaStore.getAttachmentOriginal({
                ...a,
                post: post.addr,
              })).hash,
            )),
        smallUrl: a.smallUrl
          ? (a.small
            ? urls.remoteMedia(a.small)
            : ((a.sensitive || post.sensitive)
              ? urls.remoteMediaPreload(a.smallUrl)
              : urls.remoteMedia(
                (await this.remoteMediaStore.getByUrl(new URL(a.smallUrl)))
                  .hash,
              )))
          : undefined,
        blur: a.blurhash ?? undefined,
        type: a.type,
        alt: a.alt ?? undefined,
        sensitive: a.sensitive,
      })).toArray(),
      actions: {
        like: {
          enabled: !!features.like,
        },
        upDownVote: {
          enabled: !!features.upDownVote,
        },
        emojiReact: {
          enabled: !!features.emojiReact,
        },
        zap: {
          enabled: !!features.zap,
        },
        boost: {
          enabled: !!features.boost,
        },
        reply: {
          enabled: !!features.reply,
        },
      },
    };
  }

  async remoteFeed(
    feed: ProtoAddr,
  ): Promise<{ instance: InstanceDetail; pages: PageStream<PostDetail> }> {
    const instanceUrl = urls.protoAddrInstance(feed, this.config);
    if (!instanceUrl) {
      throw InstanceNotFound.error(
        `Feed address ${protoAddrToString(feed)} has no associated instance`,
      );
    }
    return {
      instance: await this.instance(instanceUrl),
      pages: (await this.remoteFetcher.fetchFeed(feed)).mapItemsAsync((a) => {
        if ("protocol" in a) return this.post(a);
        this.remotePostStore.upsert(a, true);
        return this.#postToDetail(a);
      }),
    };
  }

  async #profileToCard(profile: RemoteProfileFull): Promise<ProfileCardDetail> {
    return {
      addr: profile.addr,
      proxies: profile.proxies,
      canonical: profile.canonical,
      name: profile.name,
      displayName: profile.displayName ?? undefined,
      type: profile.type,
      url: profile.url ?? undefined,
      instance: profile.instance ?? undefined,
      you: profile.addr.protocol === Protocol.Local,
      followedByYou: false, // TODO: OutFollowStore
      followsYou: false, // TODO: Add a "follows" check to InFollowStore
      muted: false, // TODO: Muting
      blocked: (await this.profileTrustStore.requestFromTrust(profile.addr)) <=
        TrustLevel.BlockUnlessFollow,
      followable: false, // TODO: Determine if followable
      requestToFollow: profile.requestToFollow,
      avatarUrl: profile.avatar ? urls.remoteMedia(profile.avatar) : undefined,
      avatarBlur: profile.avatarBlurhash ?? undefined,
    };
  }

  async profileCard(profile: ProtoAddr): Promise<ProfileCardDetail> {
    return this.#profileToCard(await this.remoteProfileStore.get(profile));
  }

  async profile(profile: ProtoAddr): Promise<ProfileDetail> {
    const p = await this.remoteProfileStore.get(profile, { refresh: true });
    return {
      ...await this.#profileToCard(p),
      createdAt: p.createdAt ? datetime(p.createdAt) : undefined,
      updatedAt: p.updatedAt ? datetime(p.updatedAt) : undefined,
      postCount: p.postCount,
      followingCount: p.followingCount,
      followerCount: p.followerCount,
      summary: p.summary,
      bannerUrl: p.banner ? urls.remoteMedia(p.banner) : undefined,
      bannerBlur: p.bannerBlurhash ?? undefined,
    };
  }

  async profileFeed(
    profile: ProtoAddr,
    feed: ProfileFeed,
  ): Promise<{ profile: ProfileDetail; pages: PageStream<PostDetail> }> {
    return {
      profile: await this.profile(profile),
      pages: (await this.remoteFetcher.fetchProfileFeed(profile, feed))
        .mapItemsAsync((a) => {
          if ("protocol" in a) return this.post(a);
          this.remotePostStore.upsert(a, true);
          return this.#postToDetail(a);
        }),
    };
  }

  async profileFollowers(
    profile: ProtoAddr,
  ): Promise<{ profile: ProfileDetail; pages: PageStream<ProfileCardDetail> }> {
    return {
      profile: await this.profile(profile),
      pages: (await this.remoteFetcher.fetchFollowers(profile))
        .mapItemsAsync(this.profileCard.bind(this)),
    };
  }

  async profileFollowing(
    profile: ProtoAddr,
  ): Promise<{ profile: ProfileDetail; pages: PageStream<ProfileCardDetail> }> {
    return {
      profile: await this.profile(profile),
      pages: (await this.remoteFetcher.fetchFollowing(profile))
        .mapItemsAsync(this.profileCard.bind(this)),
    };
  }

  async post(post: ProtoAddr): Promise<PostDetail> {
    return this.#postToDetail(
      await this.remotePostStore.get(post, { refresh: true }),
    );
  }

  async postThread(
    post: ProtoAddr,
  ): Promise<PageStream<PostDetail>> {
    throw new Error("Not yet implemented");
  }

  async postReactions(
    post: ProtoAddr,
  ): Promise<{ post: PostDetail; pages: PageStream<ReactionDetail> }> {
    throw new Error("Not yet implemented");
  }

  async postBoosts(
    post: ProtoAddr,
  ): Promise<{ post: PostDetail; pages: PageStream<ProfileCardDetail> }> {
    throw new Error("Not yet implemented");
  }
}
