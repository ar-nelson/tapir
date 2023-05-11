import { log } from "$/deps.ts";
import { Tag } from "$/lib/error.ts";
import { InjectableAbstract, Singleton } from "$/lib/inject.ts";
import * as urls from "$/lib/urls.ts";
import { IncomingRequestBlocked } from "$/models/DomainTrust.ts";
import { InFollowStore } from "$/models/InFollow.ts";
import { ProfileTrustStore } from "$/models/ProfileTrust.ts";
import { RemotePostStore } from "$/models/RemotePost.ts";
import { RemoteProfileStore } from "$/models/RemoteProfile.ts";
import { Protocol, RemoteProfileFull, TrustLevel } from "$/models/types.ts";
import { Activity, assertIsActor } from "$/schemas/activitypub/mod.ts";
import {
  ActivityPubClientService,
  BadActivityPub,
} from "$/services/ActivityPubClientService.ts";

export const ActivityPubFeatureNotImplemented = new Tag(
  "ActivityPub Feature Not Implemented",
);

@InjectableAbstract()
export abstract class ActivityPubInboxService {
  abstract postActivity(activity: Activity, toPersona: string): Promise<void>;
}

@Singleton(ActivityPubInboxService)
export class ActivityPubInboxServiceImpl extends ActivityPubInboxService {
  constructor(
    private readonly inFollowStore: InFollowStore,
    private readonly remotePostStore: RemotePostStore,
    private readonly remoteProfileStore: RemoteProfileStore,
    private readonly profileTrustStore: ProfileTrustStore,
    private readonly apClient: ActivityPubClientService,
  ) {
    super();
  }

  async postActivity(activity: Activity, toPersona: string) {
    log.info(JSON.stringify(activity, null, 2));
    const actor = activity.actor;
    if (typeof actor !== "string") {
      throw BadActivityPub.error("Actor must be a string");
    }
    const addr = { protocol: Protocol.ActivityPub, path: actor };
    if (
      await this.profileTrustStore.requestFromTrust(addr) < TrustLevel.Unset
    ) {
      throw IncomingRequestBlocked.error("Inbox post blocked");
    }
    const opts = { key: urls.activityPubMainKey(toPersona) };
    switch (activity.type) {
      case "Create":
      case "Announce":
      case "Question":
        if (
          await this.profileTrustStore.requestFromTrust(addr) < TrustLevel.Trust
        ) {
          log.info(
            `Silently dropping ${activity.type} from untrusted actor ${actor}`,
          );
          break;
        }
        // TODO: Handle Create for something other than a post
        await this.remotePostStore.upsert(
          await this.apClient.activityToRemotePost(activity, opts),
          false,
        );
        break;
      case "Update": {
        if (
          await this.profileTrustStore.requestFromTrust(addr) < TrustLevel.Trust
        ) {
          log.info(
            `Silently dropping Update from untrusted actor ${actor}`,
          );
          break;
        }
        const object = await this.apClient.getInlineSingleObject(
          activity.object,
          "object",
          opts,
        );
        if (object.id === actor) {
          let profile: RemoteProfileFull;
          try {
            assertIsActor(object);
            profile = await this.apClient.actorToRemoteProfile(object, opts);
          } catch (e) {
            throw BadActivityPub.wrap(e);
          }
          await this.remoteProfileStore.update(
            { protocol: Protocol.ActivityPub, path: object.id },
            profile,
          );
        }
        const attributedTo = this.apClient.getInlineSingleId(
          object.attributedTo,
          "attributedTo",
        );
        if (attributedTo !== actor) {
          throw BadActivityPub.error(
            `Object updated by ${actor} is attributed to a different actor (${attributedTo})`,
          );
        }
        if (
          !object.id ||
          urls.normalizeDomain(new URL(object.id).hostname) !==
            urls.normalizeDomain(new URL(actor).hostname)
        ) {
          throw BadActivityPub.error(
            `Actor ${actor} cannot update object ${object.id}: ID is from a different domain`,
          );
        }
        await this.remotePostStore.update(
          { protocol: Protocol.ActivityPub, path: object.id },
          await this.apClient.objectToRemotePost(object, opts),
        );
        break;
      }
      case "Delete": {
        const deleted = this.apClient.getInlineSingleId(
          activity.object,
          "object",
        );
        if (
          urls.normalizeDomain(new URL(deleted).hostname) !==
            urls.normalizeDomain(new URL(actor).hostname)
        ) {
          throw BadActivityPub.error(
            `Actor ${actor} cannot delete object ${deleted}: ID is from a different domain`,
          );
        }
        if (actor === deleted) {
          await this.remoteProfileStore.delete({
            protocol: Protocol.ActivityPub,
            path: deleted,
          });
        } else {
          await this.remotePostStore.delete({
            protocol: Protocol.ActivityPub,
            path: deleted,
          }, { protocol: Protocol.ActivityPub, path: actor });
        }
        break;
      }
      case "Follow":
        await this.inFollowStore.create({
          remoteProfile: addr,
          remoteActivity: activity.id,
          persona: toPersona,
        });
        break;
      case "Undo": {
        const id = typeof activity.object === "string"
          ? activity.object
          : `${(activity.object as { id?: string })?.id}`;
        if (!id) {
          throw BadActivityPub.error(
            "Cannot undo: no valid object ID in activity",
          );
        }
        const follow = await this.inFollowStore.get({ remoteActivity: id });
        if (!follow) {
          throw BadActivityPub.error(`Cannot undo: no activity with ID ${id}`);
        }
        await this.inFollowStore.delete({ id: follow.id });
        log.info(`Unfollowed by ${follow.remoteProfile.path}`);
        break;
      }
      case "Accept":
      case "Reject":
      case "TentativeAccept":
      case "TentativeReject":
      case "Add":
      case "Remove":
      case "Like":
      case "Dislike":
      case "EmojiReaction":
      case "View":
      case "Read":
      case "Listen":
      case "Travel":
      case "Arrive":
      case "Join":
      case "Leave":
      case "Offer":
      case "Invite":
      case "Move":
        throw ActivityPubFeatureNotImplemented.error(
          `Tapir does not yet support the ${activity.type} activity type`,
        );
      case "Flag":
      case "Block":
      case "Ignore":
        log.info(`Ignoring unsupported ${activity.type} activity`);
    }
  }
}
