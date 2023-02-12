import { matchesSchema } from "https://deno.land/x/spartanschema@v1.0.1/mod.ts";
import { Singleton } from "$/lib/inject.ts";
import { ServerConfig, ServerConfigStore } from "$/models/ServerConfig.ts";
import { PersonaStore } from "$/models/Persona.ts";
import { LocalPost, LocalPostStore } from "$/models/LocalPost.ts";
import { HttpClientService } from "$/services/HttpClientService.ts";
import { JsonLdService } from "$/services/JsonLdService.ts";
import {
  Activity,
  Actor,
  ActorSchema,
  Collection,
  CONTENT_TYPE,
  key,
  Object,
} from "$/schemas/activitypub/mod.ts";
import { publicKeyToPem } from "$/lib/signatures.ts";
import * as urls from "$/lib/urls.ts";
import defaultContext from "$/schemas/activitypub/defaultContext.json" assert {
  type: "json",
};
import * as log from "https://deno.land/std@0.176.0/log/mod.ts";

@Singleton()
export class ActivityPubService {
  constructor(
    private readonly httpClient: HttpClientService,
    private readonly serverConfigStore: ServerConfigStore,
    private readonly personaStore: PersonaStore,
    private readonly localPostStore: LocalPostStore,
    private readonly jsonLd: JsonLdService,
  ) {}

  async getPersona(name: string): Promise<Actor | undefined> {
    const serverConfig = await this.serverConfigStore.getServerConfig(),
      persona = await this.personaStore.getPersona(name);
    if (!persona) {
      return undefined;
    }
    return {
      id: urls.activityPubRoot(name, serverConfig.url),
      type: "Person",

      name: persona.displayName,
      preferredUsername: persona.name,
      url: urls.profile(persona.name, serverConfig.url),
      summary: "tapir has learned to communicate with activitypub",
      published: persona.createdAt,
      manuallyApprovesFollowers: true,
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

      icon: urls.urlJoin(serverConfig.url, "tapir-avatar.jpg"),

      publicKey: {
        id: `${urls.activityPubRoot(persona.name, serverConfig.url)}#main-key`,
        owner: urls.activityPubRoot(persona.name, serverConfig.url),
        publicKeyPem: await publicKeyToPem(
          serverConfig.publicKey,
        ),
      },
    };
  }

  private localPostToActivity(serverConfig: ServerConfig) {
    const localPostToNote = this.localPostToNote(serverConfig);
    return (post: LocalPost): Activity => ({
      id: urls.activityPubPostActivity(
        post.persona,
        post.id,
        serverConfig.url,
      ),
      type: "Create",
      actor: urls.activityPubRoot(post.persona, serverConfig.url),
      published: post.createdAt,
      to: key.Public,
      cc: urls.activityPubFollowers(post.persona, serverConfig.url),
      object: localPostToNote(post),
    });
  }

  private localPostToNote(serverConfig: ServerConfig) {
    return (post: LocalPost): Object => ({
      id: urls.activityPubPost(post.persona, post.id, serverConfig.url),
      type: "Note",
      url: urls.localPost(post.id, serverConfig.url),
      attributedTo: urls.profile(post.persona, serverConfig.url),
      content: post.content,
      published: post.createdAt,
      updated: post.createdAt,
    });
  }

  async getPostCollection(
    personaName: string,
  ): Promise<Collection | undefined> {
    const serverConfig = await this.serverConfigStore.getServerConfig(),
      persona = await this.personaStore.getPersona(personaName),
      posts = await this.localPostStore.listPosts(personaName);
    if (!persona) {
      return undefined;
    }
    return {
      id: urls.activityPubOutbox(personaName, serverConfig.url),
      type: "OrderedCollection",

      totalItems: posts.length,
      orderedItems: posts.map(this.localPostToActivity(serverConfig)),
    };
  }

  async getPostActivity(
    personaName: string,
    postId: string,
  ): Promise<Activity | undefined> {
    const serverConfig = await this.serverConfigStore.getServerConfig(),
      post = await this.localPostStore.getPost(postId);
    if (!post || post.persona !== personaName) {
      return undefined;
    }
    return this.localPostToActivity(serverConfig)(post);
  }

  async getPost(
    personaName: string,
    postId: string,
  ): Promise<Object | undefined> {
    const serverConfig = await this.serverConfigStore.getServerConfig(),
      post = await this.localPostStore.getPost(postId);
    if (!post || post.persona !== personaName) {
      return undefined;
    }
    return this.localPostToNote(serverConfig)(post);
  }

  async getFollowers(personaName: string): Promise<Collection | undefined> {
    const serverConfig = await this.serverConfigStore.getServerConfig();
    return {
      id: urls.activityPubFollowers(personaName, serverConfig.url),
      type: "OrderedCollectionPage",

      totalItems: 0,
      orderedItems: [],
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

  sendActivity(
    asPersona: string,
    url: string,
    activity: Activity,
  ): Promise<Response> {
    return this.httpClient.fetchActivityPub(asPersona, url, {
      method: "POST",
      headers: {
        "content-type": CONTENT_TYPE,
      },
      body: JSON.stringify({ "@context": defaultContext, ...activity }),
    });
  }

  private readonly isActor = matchesSchema(ActorSchema);

  async lookupActor(
    asPersona: string,
    url: string,
  ): Promise<Actor | undefined> {
    const rsp = await this.httpClient.fetchActivityPub(asPersona, url),
      json = await rsp.json(),
      compacted = await this.jsonLd.processDocument(json, {
        expandTerms: false,
        expandValues: false,
      });
    if (!this.isActor(compacted)) {
      return undefined;
    }
    return compacted;
  }

  async onInboxPost(
    personaName: string,
    activity: Activity,
  ): Promise<Response> {
    log.info(JSON.stringify(activity, null, 2));
    switch (activity.type) {
      case "Follow": {
        let actor: Actor;
        if (typeof activity.actor === "string") {
          const foundActor = await this.lookupActor(
            personaName,
            activity.actor,
          );
          if (!foundActor) {
            throw new Error(
              `Could not load Actor from ${JSON.stringify(activity.actor)}`,
            );
          }
          actor = foundActor;
        } else if (this.isActor(activity.actor)) {
          actor = activity.actor;
        } else {
          throw new Error("Activity does not contain a valid Actor");
        }
        log.info(
          `Follow from actor ${actor.name} with inbox URL ${actor.inbox}`,
        );
        const serverConfig = await this.serverConfigStore.getServerConfig(),
          rsp = await this.sendActivity(
            personaName,
            actor.inbox,
            {
              id: `${Math.random()}`,
              type: "Reject",
              actor: urls.activityPubRoot(personaName, serverConfig.url),
              to: actor.id,
              published: new Date().toISOString(),
              object: activity.id,
            },
          );
        if (rsp.status < 400) {
          log.info(
            `Follow rejection for ${activity.id} response: ${rsp.status}`,
          );
        } else {
          log.error(
            `Sending follow rejection for ${activity.id} failed: HTTP ${rsp.status} - ${await rsp
              .text()}`,
          );
        }
        const localPostToActivity = this.localPostToActivity(serverConfig),
          posts = await this.localPostStore.listPosts(personaName);
        for (const post of posts.toReversed()) {
          log.info(`Sending post ${post.id} to ${actor.inbox}`);
          const rsp = await this.sendActivity(
            personaName,
            actor.inbox,
            localPostToActivity(post),
          );
          if (rsp.status < 400) {
            log.info(`Post ${post.id} response: ${rsp.status}`);
          } else {
            log.error(
              `Sending post ${post.id} failed: HTTP ${rsp.status} - ${await rsp
                .text()}`,
            );
          }
        }
        return new Response(null, { status: 201 });
      }
      default:
        return Response.json({ error: "Not supported" }, { status: 400 });
    }
  }
}
