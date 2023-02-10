import { Singleton } from "$/lib/inject.ts";
import { ServerConfig, ServerConfigStore } from "$/models/ServerConfig.ts";
import { PersonaStore } from "$/models/Persona.ts";
import { LocalPost, LocalPostStore } from "$/models/LocalPost.ts";
import {
  Activity,
  Actor,
  Collection,
  key,
  Object,
} from "$/schemas/activitypub/mod.ts";
import { publicKeyToPem } from "$/lib/signatures.ts";
import * as urls from "$/lib/urls.ts";

@Singleton()
export class ActivityPubService {
  constructor(
    private readonly serverConfigStore: ServerConfigStore,
    private readonly personaStore: PersonaStore,
    private readonly localPostStore: LocalPostStore,
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
          serverConfig.keyPair.publicKey,
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
}
