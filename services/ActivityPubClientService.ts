import { log } from "$/deps.ts";
import { logError, LogLevels, mapOrCatchAsync, Tag } from "$/lib/error.ts";
import { InjectableAbstract, Singleton } from "$/lib/inject.ts";
import { compact } from "$/lib/json-ld/mod.ts";
import { publicKeyFromPem, signRequest } from "$/lib/signatures.ts";
import { chainFrom } from "$/lib/transducers.ts";
import { contentTypeIsJson } from "$/lib/urls.ts";
import { asArray, AssertFn } from "$/lib/utils.ts";
import { KeyStore } from "$/models/Key.ts";
import {
  AttachmentType,
  EMOJI_SHORTCODE_REGEX,
  KeyAlgorithm,
  PostType,
  ProfileType,
  ProtoAddr,
  Protocol,
  ReactionType,
  RemoteAttachment,
  RemoteEmoji,
  RemotePostFull,
  RemoteProfileFull,
  RemotePublicKey,
  RemoteReaction,
  RemoteTag,
  TAG_REGEX,
} from "$/models/types.ts";
import {
  Activity,
  Actor,
  assertIsCollection,
  assertIsCollectionPage,
  assertIsObject,
  CONTENT_TYPE,
  defaultContextJson,
  isCollectionPage,
  isLink,
  Link,
  LinkRefs,
  Object,
} from "$/schemas/activitypub/mod.ts";
import {
  DispatchFailed,
  HttpDispatcher,
  Priority,
} from "$/services/HttpDispatcher.ts";
import { JsonLdContextService } from "$/services/JsonLdContextService.ts";

export { Priority } from "$/services/HttpDispatcher.ts";

export const BadActivityPub = new Tag("Bad ActivityPub Response", {
  level: LogLevels.WARNING,
  needsStackTrace: false,
});

export type RequestOpts = {
  readonly key: string;
  readonly priority?: Priority;
  readonly overrideTrust?: boolean;
};

@InjectableAbstract()
export abstract class ActivityPubClientService {
  abstract getObject<T extends Object = Object>(
    url: URL,
    opts: RequestOpts,
    assertType?: AssertFn<T>,
  ): Promise<T>;

  abstract publishActivity(
    inbox: URL | URL[],
    activity: Activity,
    opts: RequestOpts,
    onComplete?: (response: Response, inbox: URL) => void | Promise<void>,
    onError?: (error: Error, inbox: URL) => void | Promise<void>,
  ): Promise<void>;

  abstract publishActivitiesInOrder(
    inbox: URL,
    activities: Activity[],
    opts: RequestOpts,
    onComplete?: (
      response: Response,
      activity: Activity,
    ) => void | Promise<void>,
    onError?: (error: Error, activity: Activity) => void | Promise<void>,
  ): Promise<void>;

  async getInlineSingleObject<T extends Object = Object>(
    value:
      | undefined
      | string
      | Link
      | Object
      | readonly (string | Link | Object)[],
    key: string,
    opts: RequestOpts,
    assertType: AssertFn<T> = assertIsObject,
  ): Promise<T> {
    if (Array.isArray(value)) {
      if (value.length === 1) value = value[0];
      else {
        throw BadActivityPub.error(
          `${key} must have exactly one entry; got ${value.length}`,
        );
      }
    }
    if (value == null) {
      throw BadActivityPub.error(`Missing required property ${key}`);
    }
    try {
      if (typeof value === "string" || isLink(value)) {
        const link = this.getOneLink(value);
        return await this.getObject(
          new URL(link ?? ""),
          opts,
          assertType,
        );
      }
      assertType(value);
      return value;
    } catch (e) {
      throw BadActivityPub.error(`Failed to fetch value of property ${key}`, e);
    }
  }

  getInlineSingleId(
    value:
      | undefined
      | string
      | Link
      | Object
      | readonly (string | Link | Object)[],
    key: string,
  ): string {
    if (Array.isArray(value)) {
      if (value.length === 1) value = value[0];
      else {
        throw BadActivityPub.error(
          `${key} must have exactly one entry; got ${value.length}`,
        );
      }
    }
    if (value == null) {
      throw BadActivityPub.error(`Missing required property ${key}`);
    }
    if (typeof value === "string" || isLink(value)) {
      const link = this.getOneLink(value);
      if (link != null) return link;
    }
    if (
      typeof value === "object" && "id" in value && typeof value.id === "string"
    ) {
      return value.id;
    }
    throw BadActivityPub.error(`Missing required property ${key}`);
  }

  async actorToRemoteProfile(
    actor: Actor,
    opts: RequestOpts,
  ): Promise<RemoteProfileFull> {
    let type = ProfileType.Person;
    switch (actor.type) {
      case "Application":
        type = ProfileType.Application;
        break;
      case "Group":
        type = ProfileType.Group;
        break;
      case "Organization":
        type = ProfileType.Organization;
        break;
      case "Service":
        type = ProfileType.Service;
        break;
    }
    const [followerCount, followingCount, postCount] = await Promise.all(
        [actor.followers, actor.following, actor.outbox].map(async (url) => {
          try {
            const collection = await this.getObject(
              new URL(url),
              opts,
              assertIsCollection,
            );
            return collection.totalItems ?? 0;
          } catch (e) {
            logError(
              `Failed to fetch metadata at ${url} for ActivityPub actor ${actor.id}:`,
              e,
            );
            return 0;
          }
        }),
      ),
      url = this.getOneLink(actor.url),
      proxies = chainFrom(asArray(actor.url)).filter(isLink).filter((l) =>
        l.rel === "alternate" || l.rel === "canonical"
      ).map(({ href, mediaType, rel }) => {
        const { protocol } = new URL(href);
        if (
          (protocol !== "http:" && protocol !== "https:") || !mediaType ||
          !contentTypeIsJson(mediaType)
        ) return null;
        return {
          proxy: { protocol: Protocol.ActivityPub, path: href },
          canonical: rel === "canonical",
        };
      }).notNull().toArray(),
      tagEntries = await chainFrom(asArray(actor.tag)).pipe(
        mapOrCatchAsync(
          async (t) =>
            typeof t === "string"
              ? await this.getObject(new URL(t), opts)
              : t as Object,
          [BadActivityPub, DispatchFailed],
        ),
      ).toArray();
    return {
      addr: { protocol: Protocol.ActivityPub, path: actor.id },
      url,
      name: actor.preferredUsername,
      displayName: actor.name,
      type,
      canonical: !proxies.some((p) => p.canonical),
      createdAt: actor.published == null
        ? undefined
        : new Date(actor.published),
      updatedAt: actor.updated == null ? undefined : new Date(actor.updated),
      summary: actor.summary ?? "",
      requestToFollow: !!actor.manuallyApprovesFollowers,
      profileMetadata: {
        ap: {
          streams: actor.streams,
          endpoints: actor.endpoints,
          discoverable: actor.discoverable,
          featured: actor.featured,
          featuredTags: actor.featuredTags,
          devices: actor.devices,
        },
      },
      followerCount,
      followingCount,
      postCount,
      apInbox: actor.inbox,
      apSharedInbox: actor.endpoints?.sharedInbox,
      lastSeen: new Date(),
      proxies,
      tags: chainFrom(tagEntries).map(this.objectToRemoteTag.bind(this))
        .notNull()
        .toArray(),
      emoji: chainFrom(tagEntries).map((t) => this.objectToRemoteEmoji(t, opts))
        .notNull()
        .toArray(),
      publicKeys: await chainFrom(asArray(actor.publicKey)).mapAsync(
        this.publicKeyToRemotePublicKey.bind(this),
      ).notNull().toArray(),
    };
  }

  async publicKeyToRemotePublicKey(
    { id, owner, publicKeyPem }: {
      id: string;
      owner: string;
      publicKeyPem: string;
    },
  ): Promise<RemotePublicKey | undefined> {
    try {
      const key = await publicKeyFromPem(publicKeyPem);
      return {
        name: id,
        algorithm: KeyAlgorithm.RSA_SHA256,
        owner: { protocol: Protocol.ActivityPub, path: owner },
        key: new Uint8Array(await crypto.subtle.exportKey("spki", key)),
      };
    } catch {
      return undefined;
    }
  }

  async activityToRemotePost(
    activity: Activity,
    opts: RequestOpts,
  ): Promise<RemotePostFull> {
    const actor = this.getInlineSingleId(activity.actor, "actor");
    switch (activity.type) {
      case "Announce": {
        const createdAt = activity.published && new Date(activity.published);
        if (!createdAt) {
          throw BadActivityPub.error(
            `No published date for remote post ${activity}`,
          );
        }
        return {
          addr: { protocol: Protocol.ActivityPub, path: activity.id },
          type: PostType.Boost,
          profile: { protocol: Protocol.ActivityPub, path: actor },
          canonical: true,
          createdAt,
          sensitive: false,
          targetPost: {
            protocol: Protocol.ActivityPub,
            path: this.getInlineSingleId(activity.object, "object"),
          },
          proxies: [],
          tags: [],
          mentions: [],
          emoji: [],
          attachments: [],
        };
      }
      case "Create": {
        const object = await this.getInlineSingleObject(
            activity.object,
            "object",
            opts,
          ),
          attributedTo = this.getInlineSingleId(
            object.attributedTo,
            "attributedTo",
          );
        if (attributedTo !== actor) {
          throw BadActivityPub.error(
            `Object created by ${actor} is attributed to a different actor (${attributedTo})`,
          );
        }
        return this.objectToRemotePost(object, opts);
      }
      default:
        throw BadActivityPub.error(
          `Don't know how to interpret AP activity type ${activity.type} as a remote post`,
        );
    }
  }

  async objectToRemotePost(
    object: Object,
    opts: RequestOpts,
  ): Promise<RemotePostFull> {
    const path = object.id;
    if (path == null) {
      throw BadActivityPub.error("Post object does not have @id");
    }
    const profile = this.getInlineSingleId(object.attributedTo, "attributedTo"),
      addr = { protocol: Protocol.ActivityPub, path: object.id! },
      createdAt = object.published && new Date(object.published),
      updatedAt = (object.updated && new Date(object.updated)) || undefined;
    if (!createdAt) {
      throw BadActivityPub.error(
        `No published date for remote post ${path}`,
      );
    }
    let type: PostType;
    switch (object.type) {
      case "Article":
        type = PostType.Article;
        break;
      case "Note":
        type = object.inReplyTo == null ? PostType.Note : PostType.Reply;
        break;
      case "Question":
        type = PostType.Poll;
        // TODO: Support polls
        break;
      default:
        throw BadActivityPub.error(
          `Don't know how to interpret AP object type ${object.type} as a remote post`,
        );
    }
    const url = this.getOneLink(object.url),
      proxies = chainFrom(asArray(object.url)).filter(isLink).filter((l) =>
        l.rel === "alternate" || l.rel === "canonical"
      ).map(({ href, mediaType, rel }) => {
        const { protocol } = new URL(href);
        if (
          (protocol !== "http:" && protocol !== "https:") || !mediaType ||
          !contentTypeIsJson(mediaType)
        ) return null;
        return {
          proxy: { protocol: Protocol.ActivityPub, path: href },
          canonical: rel === "canonical",
        };
      }).notNull().toArray(),
      tagEntries = await chainFrom(asArray(object.tag)).pipe(
        mapOrCatchAsync(
          async (t) =>
            typeof t === "string"
              ? await this.getObject(new URL(t), opts)
              : t as Object,
          [BadActivityPub, DispatchFailed],
        ),
      ).toArray();
    return {
      addr,
      type,
      url,
      profile: { protocol: Protocol.ActivityPub, path: profile! },
      canonical: !proxies.some((p) => p.canonical),
      createdAt,
      updatedAt,
      sensitive: !!object.sensitive,
      contentWarning: object.summary,
      proxies,
      tags: chainFrom(tagEntries).map(this.objectToRemoteTag.bind(this))
        .notNull()
        .toArray(),
      mentions: chainFrom(tagEntries).map(this.objectToRemoteMention.bind(this))
        .notNull()
        .toArray(),
      emoji: chainFrom(tagEntries).map((t) => this.objectToRemoteEmoji(t, opts))
        .notNull()
        .toArray(),
      attachments: chainFrom(asArray(object.attachment)).map(
        this.objectToRemoteAttachment.bind(this),
      ).notNull().toArray(),
    };
  }

  objectToRemoteTag(
    tag: Record<string, unknown>,
  ): Omit<RemoteTag, "post"> | undefined {
    if (
      tag.type !== "Hashtag" ||
      typeof tag.name !== "string" || typeof tag.href !== "string"
    ) {
      return undefined;
    }
    const match = TAG_REGEX.exec(tag.name);
    if (!match) return undefined;
    return {
      tag: match[1],
      inline: true,
      url: tag.href,
    };
  }

  objectToRemoteMention(tag: Record<string, unknown>): ProtoAddr | undefined {
    if (tag.type !== "Mention" || typeof tag.href !== "string") {
      return undefined;
    }
    return {
      protocol: Protocol.ActivityPub,
      path: tag.href,
    };
  }

  objectToRemoteEmoji(
    tag: Object,
    opts: RequestOpts,
  ): Omit<RemoteEmoji, "post" | "profile"> | undefined {
    if (
      tag.type !== "Emoji" || typeof tag.name !== "string" || !("icon" in tag)
    ) {
      return undefined;
    }
    const match = EMOJI_SHORTCODE_REGEX.exec(tag.name);
    if (!match) return undefined;
    let icon;
    try {
      icon = this.objectToRemoteAttachment(
        this.getInlineSingleObject(tag.icon, "icon", opts),
      );
    } catch (e) {
      logError("Failed to load custom emoji", e);
      return undefined;
    }
    if (!icon || icon.type !== AttachmentType.Image) return undefined;
    return {
      shortcode: match[1],
      url: icon.originalUrl,
    };
  }

  objectToRemoteAttachment(
    a: string | Link | Object,
  ): Omit<RemoteAttachment, "post"> | undefined {
    if (typeof a !== "string" && "url" in a) {
      const link = this.getOneLink(a.url);
      if (!link) return undefined;
      let type = AttachmentType.Download;
      switch (a.type) {
        case "Audio":
          type = AttachmentType.Audio;
          break;
        case "Image":
          type = AttachmentType.Image;
          break;
        case "Video":
          type = AttachmentType.Video;
          break;
        default:
          if (a.mediaType?.startsWith("image/")) {
            type = AttachmentType.Image;
          } else if (a.mediaType?.startsWith("audio/")) {
            type = AttachmentType.Audio;
          } else if (a.mediaType?.startsWith("video/")) {
            type = AttachmentType.Video;
          }
      }
      return {
        type,
        originalUrl: link,
        blurhash: a.blurhash,
        alt: a.summary,
        sensitive: !!a.sensitive,
      };
    }
    const link = this.getOneLink(a as string | Link);
    if (!link) return undefined;
    return {
      type: AttachmentType.Download,
      originalUrl: link,
      sensitive: false,
    };
  }

  activityToRemoteReaction(activity: Activity): RemoteReaction {
    let content: string | null, type: ReactionType;
    switch (activity.type) {
      case "Like":
        content = activity.content ?? null;
        type = ReactionType.Like;
        break;
      case "Dislike":
        content = activity.content ?? null;
        type = ReactionType.Dislike;
        break;
      case "EmojiReaction":
        content = activity.content ?? null;
        type = ReactionType.Emoji;
        if (!content) {
          throw BadActivityPub.error("EmojiReaction must have content");
        }
        break;
      case "View":
        content = null;
        type = ReactionType.View;
        break;
      default:
        throw BadActivityPub.error(
          `Don't know how to interpret AP activity type ${activity.type} as a reaction`,
        );
    }
    const createdAt = activity.published && new Date(activity.published);
    if (!createdAt) {
      throw BadActivityPub.error(
        `No published date for remote activity ${activity.id}`,
      );
    }
    // TODO: Check emoji formats
    return {
      addr: { protocol: Protocol.ActivityPub, path: activity.id },
      type,
      post: {
        protocol: Protocol.ActivityPub,
        path: this.getInlineSingleId(activity.target, "target"),
      },
      profile: {
        protocol: Protocol.ActivityPub,
        path: this.getInlineSingleId(activity.actor, "actor"),
      },
      createdAt,
      content,
    };
  }

  async *getCollection<T extends Object = Object>(
    url: URL,
    opts: RequestOpts,
    assertType: AssertFn<T> = assertIsObject,
  ): AsyncGenerator<T> {
    let page = await this.getObject(url, opts, assertIsCollection);
    if (isCollectionPage(page) && page.first) {
      if (isCollectionPage(page.first)) page = page.first;
      else {
        const firstUrl = this.getOneLink(page.first);
        if (firstUrl && firstUrl !== url.href) {
          page = await this.getObject(
            new URL(firstUrl),
            opts,
            assertIsCollectionPage,
          );
        }
      }
    }
    const nextPage = async (): Promise<boolean> => {
      if (!isCollectionPage(page) || !page.next) return false;
      let next = page.next;
      while (Array.isArray(next)) next = next[0];
      if (typeof next !== "string") {
        if ((next as Link).type === "Link") next = (next as Link).href;
        else if (isCollectionPage(next)) {
          page = next;
          return true;
        }
      }
      if (typeof next !== "string") return false;
      page = await this.getObject(new URL(next), opts, assertIsCollection);
      return true;
    };
    let lastBlank = false;
    do {
      const items = page.orderedItems ?? page.items;
      if (!items || Array.isArray(items) && items.length === 0) {
        if (lastBlank) {
          throw BadActivityPub.error(
            "Two consecutive blank pages in collection",
          );
        }
        lastBlank = true;
        continue;
      }
      lastBlank = false;
      for (const item of Array.isArray(items) ? items.flat() : [items]) {
        if (typeof item === "string") {
          yield await this.getObject(new URL(item), opts, assertType);
        } else if (typeof item === "object" && (item as Link).type === "Link") {
          yield await this.getObject(
            new URL((item as Link).href),
            opts,
            assertType,
          );
        } else {
          assertType(item);
          yield item;
        }
      }
    } while (await nextPage());
  }

  getOneLink(link: null | undefined | LinkRefs): string | undefined {
    if (!link) return undefined;
    else if (Array.isArray(link)) return this.getOneLink(link[0]);
    else if (typeof link === "string") return link;
    else return (link as Link).href;
  }
}

@Singleton(ActivityPubClientService)
export class ActivityPubClientServiceImpl extends ActivityPubClientService {
  constructor(
    private readonly httpDispatcher: HttpDispatcher,
    private readonly jsonLd: JsonLdContextService,
    private readonly keyStore: KeyStore,
  ) {
    super();
  }

  async publishActivity(
    inbox: URL | URL[],
    activity: Activity,
    opts: RequestOpts,
    onComplete?: (response: Response, inbox: URL) => void | Promise<void>,
    onError?: (error: Error, inbox: URL) => void | Promise<void>,
  ) {
    const requests = await Promise.all(
      asArray(inbox).map((inbox) =>
        this.#buildRequest(
          inbox,
          "POST",
          opts.key,
          JSON.stringify({
            "@context": defaultContextJson["@context"],
            ...activity,
          }),
        )
      ),
    );
    for (const req of requests) {
      log.info(`Dispatching ${activity.type} activity to ${inbox}`);
      this.httpDispatcher.dispatch(
        req,
        {
          priority: opts.priority ?? Priority.Soon,
          overrideTrust: opts.overrideTrust,
          throwOnError: DispatchFailed,
        },
        onComplete && ((r) => onComplete(r, new URL(req.url))),
        onError && ((e) => onError(e, new URL(req.url))),
      );
    }
  }

  async publishActivitiesInOrder(
    url: URL,
    activities: Activity[],
    opts: RequestOpts,
    onComplete?: (
      response: Response,
      activity: Activity,
    ) => void | Promise<void>,
    onError?: (error: Error, activity: Activity) => void | Promise<void>,
  ) {
    const pairs = await chainFrom(activities).mapAsync(async (activity) =>
        [
          await this.#buildRequest(
            url,
            "POST",
            opts.key,
            JSON.stringify({
              "@context": defaultContextJson["@context"],
              ...activity,
            }),
          ),
          activity,
        ] as const
      ).toArray(),
      reqs = pairs.map((p) => p[0]),
      reqToActivity = new Map(pairs);
    log.info(`Dispatching ${activities.length} activities to ${url}`);
    this.httpDispatcher.dispatchInOrder(
      reqs,
      {
        priority: opts.priority ?? Priority.Soon,
        overrideTrust: opts.overrideTrust,
        throwOnError: DispatchFailed,
      },
      onComplete && ((rsp, req) => onComplete(rsp, reqToActivity.get(req)!)),
      onError && ((e, req) => onError(e, reqToActivity.get(req)!)),
    );
  }

  async getObject<T extends Object = Object>(
    url: URL,
    opts: RequestOpts,
    assertType: AssertFn<T> = assertIsObject,
  ): Promise<T> {
    log.info(`Requesting: ${url}`);
    const rsp = await this.httpDispatcher.dispatchAndWait(
      await this.#buildRequest(url, "GET", opts.key),
      {
        priority: opts.priority ?? Priority.Immediate,
        overrideTrust: opts.overrideTrust,
        throwOnError: DispatchFailed,
      },
    );
    try {
      const json = await rsp.json(),
        compacted = await compact(
          json,
          this.jsonLd.resolver,
          await this.jsonLd.defaultContext,
        );
      assertType(
        compacted,
        `ActivityPub request for ${url} returned invalid ActivityPub JSON`,
      );
      return compacted;
    } catch (e) {
      throw BadActivityPub.error(e);
    }
  }

  async #buildRequest(
    url: URL,
    method: "GET" | "POST",
    keyName: string,
    body?: string,
  ): Promise<Request> {
    const { privateKey } = await this.keyStore.getRSA_SHA256(keyName),
      req = new Request(url, {
        method,
        headers: {
          "accept": CONTENT_TYPE,
          ...body == null ? {} : { "content-type": CONTENT_TYPE },
        },
        body,
      });
    return signRequest(req, keyName, privateKey);
  }
}
