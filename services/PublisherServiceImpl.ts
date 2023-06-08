import { Singleton } from "$/lib/inject.ts";
import { chainFrom } from "$/lib/transducers.ts";
import * as urls from "$/lib/urls.ts";
import { mapAsyncIterable } from "$/lib/utils.ts";
import { ActivityDispatchStore } from "$/models/ActivityDispatch.ts";
import { InFollowStore } from "$/models/InFollow.ts";
import { KeyStore } from "$/models/Key.ts";
import { LocalActivityStore } from "$/models/LocalActivity.ts";
import { LocalMediaStore } from "$/models/LocalMedia.ts";
import { LocalPostStore } from "$/models/LocalPost.ts";
import { RemoteProfileStore } from "$/models/RemoteProfile.ts";
import { TapirConfig } from "$/models/TapirConfig.ts";
import {
  InFollow,
  LocalAttachment,
  LocalPost,
  OutFollow,
  OutReaction,
  Persona,
  ProtoAddr,
  protoAddrToString,
  Protocol,
} from "$/models/types.ts";
import { Object } from "$/schemas/activitypub/mod.ts";
import { Priority } from "$/services/ActivityPubClientService.ts";
import { ActivityPubGeneratorService } from "$/services/ActivityPubGeneratorService.ts";
import {
  PublisherService,
  PublishFailed,
} from "$/services/PublisherService.ts";

@Singleton()
export class PublisherServiceImpl extends PublisherService {
  #activityPubInboxes: Promise<ReadonlySet<string>> | null = null;

  constructor(
    private readonly config: TapirConfig,
    private readonly keyStore: KeyStore,
    private readonly localPostStore: LocalPostStore,
    private readonly inFollowStore: InFollowStore,
    private readonly localActivityStore: LocalActivityStore,
    private readonly activityDispatchStore: ActivityDispatchStore,
    private readonly localMediaStore: LocalMediaStore,
    private readonly remoteProfileStore: RemoteProfileStore,
    private readonly apGen: ActivityPubGeneratorService,
  ) {
    super();
    inFollowStore.onChange(() => this.#activityPubInboxes = null);
  }

  #listFollowerActivityPubInboxes(
    persona: string,
  ): Promise<ReadonlySet<string>> {
    return this.#activityPubInboxes ??
      (this.#activityPubInboxes = chainFrom(
        this.inFollowStore.listFollowers(persona),
      )
        .filter((p) => p.remoteProfile.protocol === Protocol.ActivityPub)
        .mapAsync(async (p) => {
          const { apInbox, apSharedInbox } = await this.remoteProfileStore.get(
            p.remoteProfile,
            { priority: Priority.Soon },
          );
          return apSharedInbox || apInbox;
        })
        .notNull()
        .toSet());
  }

  async publishPostHistory(personaName: string, to: ProtoAddr | URL) {
    if (to instanceof URL) {
      throw PublishFailed.error(
        "Publish post to specific URL not yet implemented",
      );
    }
    try {
      const profile = await this.remoteProfileStore.get(to),
        inbox = profile.apInbox || profile.apSharedInbox;
      if (!inbox) {
        throw PublishFailed.error(
          `No ActivityPub inbox for profile ${protoAddrToString(to)}`,
        );
      }
      await this.activityDispatchStore.dispatchInOrder(
        new URL(inbox),
        mapAsyncIterable(
          this.localPostStore.list({ persona: personaName, order: "ASC" }),
          (x) => x.id,
        ),
        {
          key: urls.activityPubMainKey(personaName),
          priority: Priority.Spaced,
        },
      );
    } catch (e) {
      throw PublishFailed.wrap(e);
    }
  }

  async publishPost(postId: string, to: ProtoAddr | URL) {
    if (to instanceof URL) {
      throw PublishFailed.error(
        "Publish post to specific URL not yet implemented",
      );
    }
    try {
      const profile = await this.remoteProfileStore.get(to),
        inbox = profile.apInbox || profile.apSharedInbox;
      if (!inbox) {
        throw PublishFailed.error(
          `No ActivityPub inbox for profile ${protoAddrToString(to)}`,
        );
      }
      const { persona } = await this.localPostStore.get(postId);
      await this.activityDispatchStore.dispatch(
        new URL(inbox),
        postId,
        {
          key: urls.activityPubMainKey(persona),
          priority: Priority.Spaced,
        },
      );
    } catch (e) {
      throw PublishFailed.wrap(e);
    }
  }

  async createPost(post: LocalPost, attachments: readonly LocalAttachment[]) {
    try {
      const activity = this.apGen.localPost(
        post,
        await Promise.all(
          attachments.map(async (a) => {
            const { width, height, mimetype } = await this.localMediaStore
              .getMeta(a.original);
            return {
              width,
              height,
              mimetype,
              hash: a.original,
              ...a,
            };
          }),
        ),
      );
      // TODO: Visibility restrictions
      await this.activityDispatchStore.createAndDispatch(
        [
          ...await this.#listFollowerActivityPubInboxes(
            post.persona,
          ),
        ].map((s) => new URL(s)),
        activity,
        {
          key: urls.activityPubMainKey(post.persona),
        },
        post.id,
      );
    } catch (e) {
      throw PublishFailed.wrap(e);
    }
  }

  async updatePost(update: LocalPost & { readonly updatedAt: Date }) {
    try {
      const existing = await this.localPostStore.get(update.id),
        originalJson = await this.localActivityStore.getObject(update.id),
        newJson: Object = {
          ...originalJson,
          updated: update.updatedAt.toJSON(),
          content: update.contentHtml ?? originalJson.content,
          summary: update.contentWarning ?? originalJson.summary,
          sensitive: update.contentWarning === undefined
            ? originalJson.sensitive
            : update.contentWarning != null,
        };
      await this.activityDispatchStore.createAndDispatch(
        await this.activityDispatchStore.inboxesWhichReceived(update.id),
        this.apGen.publicActivity(existing.persona, {
          type: "Update",
          createdAt: update.updatedAt,
          target: urls.activityPubObject(update.id, this.config.url),
          object: newJson,
        }),
        {
          key: urls.activityPubMainKey(update.persona),
        },
      );
      await this.localActivityStore.updateObject(update.id, newJson);
    } catch (e) {
      throw PublishFailed.wrap(e);
    }
  }

  async deletePost(ulid: string) {
    try {
      const { persona } = await this.localPostStore.get(ulid);

      // TODO: This is not suffficient if there are still pending Creates!
      // The pending Creates should be canceled.
      // Also a Delete should probably just be spammed to the whole network.
      await this.activityDispatchStore.createAndDispatch(
        await this.activityDispatchStore.inboxesWhichReceived(ulid),
        this.apGen.publicActivity(persona, {
          type: "Delete",
          target: urls.activityPubObject(ulid, this.config.url),
        }),
        {
          key: urls.activityPubMainKey(persona),
        },
      );
    } catch (e) {
      throw PublishFailed.wrap(e);
    }
  }

  async acceptInFollow(follow: InFollow) {
    if (follow.remoteProfile.protocol !== Protocol.ActivityPub) {
      throw PublishFailed.error(
        `Don't know how to accept follow from ${
          protoAddrToString(follow.remoteProfile)
        } (bad protocol)`,
      );
    }
    if (!follow.remoteActivity) {
      throw PublishFailed.error(
        `Don't know how to accept follow from ${
          protoAddrToString(follow.remoteProfile)
        } (no follow activity)`,
      );
    }
    try {
      const profile = await this.remoteProfileStore.get(follow.remoteProfile),
        inbox = profile.apInbox || profile.apSharedInbox;
      if (!inbox) {
        throw PublishFailed.error(
          `No ActivityPub inbox for profile ${
            protoAddrToString(follow.remoteProfile)
          }`,
        );
      }
      await this.activityDispatchStore.createAndDispatch(
        new URL(inbox),
        this.apGen.directActivity(follow.persona, follow.remoteProfile.path, {
          type: "Accept",
          createdAt: follow.createdAt,
          object: follow.remoteActivity,
        }),
        {
          key: urls.activityPubMainKey(follow.persona),
        },
      );
    } catch (e) {
      throw PublishFailed.wrap(e);
    }
  }

  async rejectInFollow(follow: InFollow) {
    if (follow.remoteProfile.protocol !== Protocol.ActivityPub) {
      throw PublishFailed.error(
        `Don't know how to reject follow from ${
          protoAddrToString(follow.remoteProfile)
        } (bad protocol)`,
      );
    }
    if (!follow.remoteActivity) {
      throw PublishFailed.error(
        `Don't know how to reject follow from ${
          protoAddrToString(follow.remoteProfile)
        } (no follow activity)`,
      );
    }
    try {
      const profile = await this.remoteProfileStore.get(follow.remoteProfile),
        inbox = profile.apInbox || profile.apSharedInbox;
      if (!inbox) {
        throw PublishFailed.error(
          `No ActivityPub inbox for profile ${
            protoAddrToString(follow.remoteProfile)
          }`,
        );
      }
      await this.activityDispatchStore.createAndDispatch(
        new URL(inbox),
        this.apGen.directActivity(follow.persona, follow.remoteProfile.path, {
          type: "Reject",
          createdAt: follow.createdAt,
          object: follow.remoteActivity,
        }),
        {
          key: urls.activityPubMainKey(follow.persona),
        },
      );
    } catch (e) {
      throw PublishFailed.wrap(e);
    }
  }

  async createOutFollow(follow: OutFollow) {
    throw PublishFailed.error("Not yet implemented");
  }

  async deleteOutFollow(follow: OutFollow) {
    throw PublishFailed.error("Not yet implemented");
  }

  async createReaction(reaction: OutReaction) {
    throw PublishFailed.error("Not yet implemented");
  }

  async deleteReaction(reaction: OutReaction) {
    throw PublishFailed.error("Not yet implemented");
  }

  async createPersona() {
    // Do nothing.
    // TODO: Should this produce an Activity?
  }

  async updatePersona(persona: Persona & { readonly updatedAt: Date }) {
    try {
      await this.activityDispatchStore.createAndDispatch(
        await this.#listFollowerActivityPubInboxes(persona.name),
        this.apGen.publicActivity(
          persona.name,
          {
            type: "Update",
            object: this.apGen.actor(
              persona,
              [await this.keyStore.get(urls.activityPubMainKey(persona.name))],
            ),
          },
        ),
        {
          key: urls.activityPubMainKey(persona.name),
        },
      );
    } catch (e) {
      throw PublishFailed.wrap(e);
    }
  }

  async deletePersona(personaName: string) {
    try {
      await this.activityDispatchStore.createAndDispatch(
        await this.#listFollowerActivityPubInboxes(personaName),
        this.apGen.publicActivity(
          personaName,
          {
            type: "Delete",
            object: {
              id: urls.activityPubActor(personaName, this.config.url),
              type: "Person",
            },
          },
        ),
        {
          key: urls.activityPubMainKey(personaName),
        },
      );

      /// TODO: Should this be here? It's needed to break a dependency cycle,
      // but doing it here breaks the single responsibility principle.
      await this.inFollowStore.deleteAllForPersona(personaName);
    } catch (e) {
      throw PublishFailed.wrap(e);
    }
  }
}
