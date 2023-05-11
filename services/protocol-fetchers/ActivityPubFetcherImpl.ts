import { mapOrCatchAsync } from "$/lib/error.ts";
import { Singleton } from "$/lib/inject.ts";
import * as urls from "$/lib/urls.ts";
import { PersonaStore } from "$/models/Persona.ts";
import { TapirConfig } from "$/models/TapirConfig.ts";
import {
  PostType,
  ProfileFeed,
  Protocol,
  RemotePostFull,
} from "$/models/types.ts";
import {
  assertIsActivity,
  assertIsActor,
  assertIsCollection,
  assertIsCollectionPage,
  Collection,
  CollectionPage,
  isActivity,
  isCollectionPage,
  isLink,
  isObject,
  Link,
  Object,
} from "$/schemas/activitypub/mod.ts";
import {
  ActivityPubClientService,
  BadActivityPub,
  Priority,
  RequestOpts,
} from "$/services/ActivityPubClientService.ts";
import {
  ActivityPubFetcher,
  FinitePageStream,
  LocalFetcher,
} from "$/services/RemoteFetcherService.ts";

@Singleton(ActivityPubFetcher)
export class ActivityPubFetcherImpl extends ActivityPubFetcher {
  constructor(
    private readonly config: TapirConfig,
    private readonly personaStore: PersonaStore,
    private readonly apClient: ActivityPubClientService,
    private readonly localFetcher: LocalFetcher,
  ) {
    super();
  }

  // TODO: Use ProfileTrust to override trust settings on requests

  async fetchProfile(profilePath: string, priority = Priority.Immediate) {
    const localActor = urls.isActivityPubActor(profilePath, this.config.url);
    if (localActor != null) return this.localFetcher.fetchProfile(localActor);
    const mainPersona = (await this.personaStore.getMain()).name,
      opts = { key: urls.activityPubMainKey(mainPersona), priority },
      actor = await this.apClient.getObject(
        new URL(profilePath),
        opts,
        assertIsActor,
      );
    return this.apClient.actorToRemoteProfile(actor, opts);
  }

  async #collectionPages(
    collection: string | Link | Collection | undefined,
    opts: RequestOpts,
  ): Promise<FinitePageStream<string | Link | Object>> {
    if (collection == null) return FinitePageStream.empty();
    let collectionRoot: Collection;
    if (typeof collection === "string" || isLink(collection)) {
      const link = this.apClient.getOneLink(collection);
      if (!link) return FinitePageStream.empty();
      collectionRoot = await this.apClient.getObject(
        new URL(this.apClient.getOneLink(collection)!),
        opts,
        assertIsCollection,
      );
    } else collectionRoot = collection;
    return new FinitePageStream(
      async (cursor?: string) => {
        let collection: CollectionPage;
        if (cursor == null) {
          if (isCollectionPage(collectionRoot.first)) {
            collection = collectionRoot.first;
          } else {
            const first = this.apClient.getOneLink(
              collectionRoot.first as string | Link,
            );
            if (first) {
              collection = await this.apClient.getObject(
                new URL(first),
                opts,
                assertIsCollectionPage,
              );
            } else {throw BadActivityPub.error(
                `No first entry in collection at ${collectionRoot.id}`,
              );}
          }
        } else {
          collection = await this.apClient.getObject(
            new URL(cursor),
            opts,
            assertIsCollectionPage,
          );
        }
        const items = collection.orderedItems ?? collection.items ?? [];
        return {
          items: Array.isArray(items) ? items : [items],
          nextCursor: this.apClient.getOneLink(
            collection.next as string | Link,
          ),
        };
      },
      collectionRoot.totalItems ?? Infinity,
    );
  }

  async fetchFollowers(profilePath: string, priority = Priority.Immediate) {
    const localActor = urls.isActivityPubActor(profilePath, this.config.url);
    if (localActor != null) return this.localFetcher.fetchFollowers(localActor);
    const mainPersona = (await this.personaStore.getMain()).name,
      opts = { key: urls.activityPubMainKey(mainPersona), priority },
      { followers } = await this.apClient.getObject(
        new URL(profilePath),
        opts,
        assertIsActor,
      ),
      stream = await this.#collectionPages(followers, opts);
    return stream.mapItems((i, cursor) => {
      const path = typeof i !== "string" && isObject(i)
        ? i.id
        : this.apClient.getOneLink(i);
      if (path == null) {
        throw BadActivityPub.error(
          `No URL or @id for followers collection entry at ${
            cursor ?? followers
          }`,
        );
      }
      return { protocol: Protocol.ActivityPub, path };
    });
  }

  async fetchFollowing(profilePath: string, priority = Priority.Immediate) {
    const localActor = urls.isActivityPubActor(profilePath, this.config.url);
    if (localActor != null) return this.localFetcher.fetchFollowers(localActor);
    const mainPersona = (await this.personaStore.getMain()).name,
      opts = { key: urls.activityPubMainKey(mainPersona), priority },
      { following } = await this.apClient.getObject(
        new URL(profilePath),
        opts,
        assertIsActor,
      ),
      stream = await this.#collectionPages(following, opts);
    return stream.mapItems((i, cursor) => {
      const path = typeof i !== "string" && isObject(i)
        ? i.id
        : this.apClient.getOneLink(i);
      if (path == null) {
        throw BadActivityPub.error(
          `No URL or @id for following collection entry at ${
            cursor ?? following
          }`,
        );
      }
      return { protocol: Protocol.ActivityPub, path };
    });
  }

  async fetchProfileFeed(
    profilePath: string,
    feed = ProfileFeed.Posts,
    priority = Priority.Immediate,
  ) {
    const localActor = urls.isActivityPubActor(profilePath, this.config.url);
    if (localActor != null) {
      return this.localFetcher.fetchProfileFeed(localActor, feed);
    }
    const mainPersona = (await this.personaStore.getMain()).name,
      opts = { key: urls.activityPubMainKey(mainPersona), priority },
      { outbox } = await this.apClient.getObject(
        new URL(profilePath),
        opts,
        assertIsActor,
      ),
      stream = await this.#collectionPages(outbox, opts),
      getPost = async (item: string | Link | Object) =>
        this.apClient.activityToRemotePost(
          await this.apClient.getInlineSingleObject(
            item,
            "items",
            opts,
            assertIsActivity,
          ),
          opts,
        );
    let filter: (x: RemotePostFull) => boolean = () => true;
    switch (feed) {
      case ProfileFeed.Posts:
        filter = (x) => x.type !== PostType.Reply;
        break;
      case ProfileFeed.OwnPosts:
        filter = (x) => x.type !== PostType.Boost;
        break;
      case ProfileFeed.Media:
        filter = (x) => x.attachments.length > 0;
        break;
    }
    return stream.transducePages((xf) =>
      xf.pipe(mapOrCatchAsync(getPost, BadActivityPub)).filter(filter)
    );
  }

  async fetchPost(postPath: string, priority = Priority.Immediate) {
    const localPost = urls.isActivityPubActivity(postPath, this.config.url);
    if (localPost != null) {
      return this.localFetcher.fetchPost(localPost);
    }
    const mainPersona = (await this.personaStore.getMain()).name,
      opts = { key: urls.activityPubMainKey(mainPersona), priority },
      object = await this.apClient.getObject(new URL(postPath), opts);
    return isActivity(object)
      ? this.apClient.activityToRemotePost(object, opts)
      : this.apClient.objectToRemotePost(object, opts);
  }

  async fetchReplies(postPath: string, priority = Priority.Immediate) {
    const localPost = urls.isActivityPubActivity(postPath, this.config.url);
    if (localPost != null) {
      return this.localFetcher.fetchReplies(localPost);
    }
    const mainPersona = (await this.personaStore.getMain()).name,
      opts = { key: urls.activityPubMainKey(mainPersona), priority },
      activity = await this.apClient.getObject(
        new URL(postPath),
        opts,
        assertIsActivity,
      ),
      object = await this.apClient.getInlineSingleObject(
        activity.object,
        "object",
        opts,
      ),
      stream = await this.#collectionPages(object.replies, opts);
    return stream.mapItemsAsync(async (i) =>
      isActivity(i) ? await this.apClient.objectToRemotePost(i, opts) : {
        protocol: Protocol.ActivityPub,
        path: this.apClient.getInlineSingleId(i, "replies"),
      }
    );
  }

  async fetchReactions(
    postPath: string,
    priority = Priority.Immediate,
  ) {
    const localPost = urls.isActivityPubActivity(postPath, this.config.url);
    if (localPost != null) {
      return this.localFetcher.fetchReactions(localPost);
    }
    const mainPersona = (await this.personaStore.getMain()).name,
      opts = { key: urls.activityPubMainKey(mainPersona), priority },
      activity = await this.apClient.getObject(
        new URL(postPath),
        opts,
        assertIsActivity,
      ),
      object = await this.apClient.getInlineSingleObject(
        activity.object,
        "object",
        opts,
      ),
      stream = await this.#collectionPages(object.likes, opts);
    return stream.mapItemsAsync(async (i) => {
      const activity = await this.apClient.getInlineSingleObject(
        i,
        "likes",
        opts,
        assertIsActivity,
      );
      return this.apClient.activityToRemoteReaction(activity);
    });
  }

  async fetchBoosts(
    postPath: string,
    priority = Priority.Immediate,
  ) {
    const localPost = urls.isActivityPubActivity(postPath, this.config.url);
    if (localPost != null) {
      return this.localFetcher.fetchBoosts(localPost);
    }
    const mainPersona = (await this.personaStore.getMain()).name,
      opts = { key: urls.activityPubMainKey(mainPersona), priority },
      activity = await this.apClient.getObject(
        new URL(postPath),
        opts,
        assertIsActivity,
      ),
      object = await this.apClient.getInlineSingleObject(
        activity.object,
        "object",
        opts,
      ),
      stream = await this.#collectionPages(object.shares, opts);
    return stream.mapItemsAsync(async (i) =>
      isActivity(i) ? await this.apClient.activityToRemotePost(i, opts) : {
        protocol: Protocol.ActivityPub,
        path: this.apClient.getInlineSingleId(i, "replies"),
      }
    );
  }

  async fetchFeed(
    feedPath: string,
    priority: Priority = Priority.Immediate,
  ) {
    if (feedPath.startsWith(this.config.url)) {
      return this.localFetcher.fetchFeed(new URL(feedPath).pathname);
    }
    const mainPersona = (await this.personaStore.getMain()).name,
      opts = { key: urls.activityPubMainKey(mainPersona), priority },
      stream = await this.#collectionPages(feedPath, opts);
    return stream.transducePages((xf) =>
      xf.pipe(mapOrCatchAsync(async (p) => {
        if (typeof p === "string" || isLink(p)) {
          const link = this.apClient.getOneLink(p);
          if (link == null) {
            throw BadActivityPub.error("Expected Activity or Link");
          }
          return { protocol: Protocol.ActivityPub, path: link };
        } else {
          try {
            assertIsActivity(p);
          } catch (e) {
            throw BadActivityPub.error("Expected Activity", e);
          }
          return await this.apClient.activityToRemotePost(p, opts);
        }
      }, BadActivityPub))
    );
  }
}
