import { log } from "$/deps.ts";
import { Injector, Singleton } from "$/lib/inject.ts";
import { compact, Document } from "$/lib/json-ld/mod.ts";
import { chainFrom } from "$/lib/transducers.ts";
import * as urls from "$/lib/urls.ts";
import { InFollowStore } from "$/models/InFollow.ts";
import { KeyStore } from "$/models/Key.ts";
import { LocalActivityStore } from "$/models/LocalActivity.ts";
import { LocalPostStore } from "$/models/LocalPost.ts";
import { PersonaStore } from "$/models/Persona.ts";
import { TapirConfig } from "$/models/TapirConfig.ts";
import { Protocol } from "$/models/types.ts";
import {
  Activity,
  Actor,
  assertIsActivity,
  Collection,
  Object,
} from "$/schemas/activitypub/mod.ts";
import { BadActivityPub } from "$/services/ActivityPubClientService.ts";
import { ActivityPubGeneratorService } from "$/services/ActivityPubGeneratorService.ts";
import { ActivityPubInboxService } from "$/services/ActivityPubInboxService.ts";
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
    private readonly keyStore: KeyStore,
    private readonly localPostStore: LocalPostStore,
    private readonly localActivityStore: LocalActivityStore,
    private readonly inFollowStore: InFollowStore,
    private readonly apGen: ActivityPubGeneratorService,
    private readonly apInbox: ActivityPubInboxService,
    private readonly jsonLd: JsonLdContextService,
  ) {}

  async #canonicalizeIncomingActivity(json: Document): Promise<Activity> {
    try {
      const compacted = await compact(
        json,
        this.jsonLd.resolver,
        await this.jsonLd.defaultContext,
      );
      assertIsActivity(compacted);
      return compacted;
    } catch (e) {
      throw BadActivityPub.error("Request body was not a valid Activity", e);
    }
  }

  async getPersona(name: string): Promise<Actor> {
    const persona = await this.personaStore.get(name);
    return this.apGen.actor(persona, [
      await this.keyStore.get(urls.activityPubMainKey(name)),
    ]);
  }

  async getPostCollection(
    personaName: string,
  ): Promise<Collection> {
    await this.personaStore.get(personaName);
    const posts: Activity[] = [];
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

  async getFollowers(personaName: string): Promise<Collection> {
    return this.apGen.collectionPage(
      urls.activityPubFollowers(personaName, this.config.url),
      await chainFrom(this.inFollowStore.listFollowers(personaName)).map((f) =>
        f.remoteProfile.protocol === Protocol.ActivityPub
          ? f.remoteProfile.path
          : null
      ).notNull().toArray(),
    );
  }

  getFollowing(personaName: string): Promise<Collection> {
    return Promise.resolve(this.apGen.collectionPage(
      urls.activityPubFollowing(personaName, this.config.url),
      [],
    ));
  }

  async getActivity(id: string): Promise<Activity> {
    return (await this.localActivityStore.get(id)).json;
  }

  getObject(id: string): Promise<Object> {
    return this.localActivityStore.getObject(id);
  }

  async onInboxPost(activityJson: Document, toPersona: string): Promise<void> {
    const activity = await this.#canonicalizeIncomingActivity(activityJson);
    return this.apInbox.postActivity(activity, toPersona);
  }
}
