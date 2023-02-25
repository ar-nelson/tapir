import { Injector, Singleton } from "$/lib/inject.ts";
import { ServerConfigStore } from "$/models/ServerConfig.ts";
import { PersonaStore } from "$/models/Persona.ts";
import { LocalPostStore } from "$/models/LocalPost.ts";
import { LocalActivityStore } from "$/models/LocalActivity.ts";
import {
  InFollowError,
  InFollowErrorType,
  InFollowStore,
} from "$/models/InFollow.ts";
import {
  Activity,
  Actor,
  Collection,
  defaultContext,
  isActivity,
  Object,
} from "$/schemas/activitypub/mod.ts";
import { JsonLdService } from "$/services/JsonLdService.ts";
import { JsonLdDocument } from "$/lib/jsonld.ts";
import { publicKeyToPem } from "$/lib/signatures.ts";
import { asyncToArray } from "$/lib/utils.ts";
import * as urls from "$/lib/urls.ts";
import * as log from "https://deno.land/std@0.176.0/log/mod.ts";

export interface HandlerState {
  injector: Injector;
  controller: ActivityPubController;
}

@Singleton()
export class ActivityPubController {
  constructor(
    private readonly serverConfigStore: ServerConfigStore,
    private readonly personaStore: PersonaStore,
    private readonly localPostStore: LocalPostStore,
    private readonly localActivityStore: LocalActivityStore,
    private readonly inFollowStore: InFollowStore,
    private readonly jsonLd: JsonLdService,
  ) {}

  async canonicalizeIncomingActivity(
    json: JsonLdDocument,
  ): Promise<Activity | null> {
    const compacted = await this.jsonLd.processDocument({
      ...await this.jsonLd.processDocument(json),
      "@context": defaultContext,
    }, { expandTerms: false });
    return isActivity(compacted) ? compacted : null;
  }

  async getPersona(name: string): Promise<Actor | undefined> {
    const serverConfig = await this.serverConfigStore.getServerConfig(),
      persona = await this.personaStore.get(name);
    if (!persona) {
      return undefined;
    }
    return {
      id: urls.activityPubActor(name, serverConfig.url),
      type: "Person",

      name: persona.displayName,
      preferredUsername: persona.name,
      url: urls.profile(persona.name, serverConfig.url),
      summary: persona.summary,
      published: persona.createdAt,
      manuallyApprovesFollowers: persona.requestToFollow,
      discoverable: false,

      inbox: urls.activityPubInbox(persona.name, serverConfig.url),
      outbox: urls.activityPubOutbox(persona.name, serverConfig.url),
      followers: urls.activityPubFollowers(
        persona.name,
        serverConfig.url,
      ),
      following: urls.activityPubFollowing(
        persona.name,
        serverConfig.url,
      ),

      icon: {
        type: "Image",
        mediaType: "image/jpeg",
        url: urls.urlJoin(serverConfig.url, "tapir-avatar.jpg"),
      },

      publicKey: {
        id: `${urls.activityPubActor(persona.name, serverConfig.url)}#main-key`,
        owner: urls.activityPubActor(persona.name, serverConfig.url),
        publicKeyPem: await publicKeyToPem(
          serverConfig.publicKey,
        ),
      },
    };
  }

  async getPostCollection(
    personaName: string,
  ): Promise<Collection | undefined> {
    const serverConfig = await this.serverConfigStore.getServerConfig(),
      persona = await this.personaStore.get(personaName),
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
    return {
      id: urls.activityPubOutbox(personaName, serverConfig.url),
      type: "OrderedCollection",

      totalItems: posts.length,
      orderedItems: posts,
    };
  }

  async getFollowers(personaName: string): Promise<Collection | undefined> {
    const serverConfig = await this.serverConfigStore.getServerConfig(),
      followers = await asyncToArray(
        this.inFollowStore.listFollowers(personaName),
      );
    return {
      id: urls.activityPubFollowers(personaName, serverConfig.url),
      type: "OrderedCollectionPage",

      totalItems: followers.length,
      orderedItems: followers.map((f) => f.actor),
    };
  }

  async getFollowing(personaName: string): Promise<Collection | undefined> {
    const serverConfig = await this.serverConfigStore.getServerConfig();
    return {
      id: urls.activityPubFollowing(personaName, serverConfig.url),
      type: "OrderedCollectionPage",

      totalItems: 0,
      orderedItems: [],
    };
  }

  async getActivity(id: string): Promise<Activity | null> {
    return (await this.localActivityStore.get(id))?.json as Activity | null;
  }

  getObject(id: string): Promise<Object | null> {
    return this.localActivityStore.getObject(id);
  }

  async onInboxPost(
    personaName: string,
    activity: Activity,
  ): Promise<Response> {
    log.info(JSON.stringify(activity, null, 2));
    const actor = activity.actor;
    if (typeof actor !== "string") {
      return this.#errorResponse("Actor must be a string");
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
              return this.#errorResponse(e.message, 409);
            default:
              return this.#errorResponse(e.message);
          }
        }
        return new Response(null, { status: 202 });
      case "Undo": {
        const id = typeof activity.object === "string"
          ? activity.object
          : `${(activity.object as { id?: string })?.id}`;
        if (!id) {
          return this.#errorResponse(
            `Cannot undo: no valid object ID in activity`,
          );
        }
        const follow = await this.inFollowStore.get({ id });
        if (!follow) {
          return this.#errorResponse(`Cannot undo: no activity with ID ${id}`);
        }
        await this.inFollowStore.delete({ id });
        log.info(`Unfollowed by ${follow.actor}`);
        return new Response(null, { status: 202 });
      }
      default:
        return this.#errorResponse("Not supported");
    }
  }

  #errorResponse(message: string, status = 400) {
    log.error(message);
    return Response.json({ error: message }, { status });
  }
}
