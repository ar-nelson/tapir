import { log, Status } from "$/deps.ts";
import { Injector, Singleton } from "$/lib/inject.ts";
import { compact, ContextSrc, Document } from "$/lib/json-ld/mod.ts";
import * as urls from "$/lib/urls.ts";
import { asyncToArray } from "$/lib/utils.ts";
import {
  InFollowError,
  InFollowErrorType,
  InFollowStore,
} from "$/models/InFollow.ts";
import { LocalActivityStore } from "$/models/LocalActivity.ts";
import { LocalPostStore } from "$/models/LocalPost.ts";
import { PersonaStore } from "$/models/Persona.ts";
import { TapirConfig } from "$/models/TapirConfig.ts";
import {
  Activity,
  Actor,
  assertIsActivity,
  Collection,
  Object,
} from "$/schemas/activitypub/mod.ts";
import { ActivityPubGeneratorService } from "$/services/ActivityPubGeneratorService.ts";
import { JsonLdContextService } from "$/services/JsonLdContextService.ts";

export interface HandlerState {
  injector: Injector;
  controller: ActivityPubController;
}

@Singleton()
export class ActivityPubController {
  constructor(
    private readonly config: TapirConfig,
    private readonly personaStore: PersonaStore,
    private readonly localPostStore: LocalPostStore,
    private readonly localActivityStore: LocalActivityStore,
    private readonly inFollowStore: InFollowStore,
    private readonly apGen: ActivityPubGeneratorService,
    private readonly jsonLd: JsonLdContextService,
  ) {}

  async canonicalizeIncomingActivity(json: Document): Promise<Activity> {
    const compacted = await compact(
      json,
      this.jsonLd.resolver,
      await this.jsonLd.defaultContext,
    );
    assertIsActivity(compacted);
    return compacted;
  }

  async getPersona(name: string): Promise<Actor | undefined> {
    const persona = await this.personaStore.get(name);
    if (!persona) {
      return undefined;
    }
    return this.apGen.actor(persona, await this.personaStore.publicKey(name));
  }

  async getPostCollection(
    personaName: string,
  ): Promise<Collection | undefined> {
    const persona = await this.personaStore.get(personaName),
      posts: Activity[] = [];
    if (!persona) {
      return undefined;
    }
    for await (
      const { id } of this.localPostStore.list({
        persona: personaName,
        order: "DESC",
      })
    ) {
      const activity = await this.localActivityStore.get(id);
      if (activity == null) {
        log.warning(`Local post ${id} has no corresponding activity!`);
        continue;
      }
      posts.push(activity.json);
    }
    return this.apGen.collection(
      urls.activityPubOutbox(personaName, this.config.url),
      posts,
    );
  }

  async getFollowers(personaName: string): Promise<Collection | undefined> {
    return this.apGen.collectionPage(
      urls.activityPubFollowers(personaName, this.config.url),
      await asyncToArray(this.inFollowStore.listFollowers(personaName)),
    );
  }

  getFollowing(personaName: string): Promise<Collection | undefined> {
    return Promise.resolve(this.apGen.collectionPage(
      urls.activityPubFollowing(personaName, this.config.url),
      [],
    ));
  }

  async getActivity(id: string): Promise<Activity | null> {
    return (await this.localActivityStore.get(id))?.json as Activity | null;
  }

  getObject(id: string): Promise<Object | null> {
    return this.localActivityStore.getObject(id);
  }

  async onInboxPost(
    personaName: string,
    { "@context": _context, ...activity }: Activity & {
      "@context"?: ContextSrc;
    },
  ): Promise<{ error: string; status?: number } | null> {
    log.info(JSON.stringify(activity, null, 2));
    const actor = activity.actor;
    if (typeof actor !== "string") {
      return { error: "Actor must be a string" };
    }
    switch (activity.type) {
      case "Follow":
        try {
          await this.inFollowStore.create({
            id: activity.id,
            actor,
            persona: personaName,
          });
        } catch (e) {
          if (!(e instanceof InFollowError)) throw e;
          log.error(e.message);
          switch (e.type) {
            case InFollowErrorType.DuplicateFollow:
              return { error: e.message, status: Status.Conflict };
            default:
              return { error: e.message };
          }
        }
        return null;
      case "Undo": {
        const id = typeof activity.object === "string"
          ? activity.object
          : `${(activity.object as { id?: string })?.id}`;
        if (!id) {
          return { error: `Cannot undo: no valid object ID in activity` };
        }
        const follow = await this.inFollowStore.get({ id });
        if (!follow) {
          return { error: `Cannot undo: no activity with ID ${id}` };
        }
        await this.inFollowStore.delete({ id });
        log.info(`Unfollowed by ${follow.actor}`);
        return null;
      }
      default:
        return { error: "Not supported" };
    }
  }
}
