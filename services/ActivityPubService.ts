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
import { getLogger } from "https://deno.land/std@0.176.0/log/mod.ts";

@Singleton()
export class ActivityPubService {
  private readonly log = getLogger("ActivityPubService");

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
      "@id": urls.activityPubRoot(name, serverConfig.url),
      "@type": key.Person,

      [key.name]: persona.displayName,
      [key.preferredUsername]: persona.name,
      [key.url]: urls.profile(persona.name, serverConfig.url),
      [key.summary]: "tapir has learned to communicate with activitypub",
      [key.published]: persona.createdAt,
      [key.manuallyApprovesFollowers]: true,
      [key.discoverable]: false,

      [key.inbox]: urls.activityPubInbox(persona.name, serverConfig.url),
      [key.outbox]: urls.activityPubOutbox(persona.name, serverConfig.url),
      [key.followers]: urls.activityPubFollowers(
        persona.name,
        serverConfig.url,
      ),
      [key.following]: urls.activityPubFollowing(
        persona.name,
        serverConfig.url,
      ),

      [key.icon]: urls.urlJoin(serverConfig.url, "tapir-avatar.jpg"),

      [key.publicKey]: {
        "@id": `${
          urls.activityPubRoot(persona.name, serverConfig.url)
        }#main-key`,
        [key.owner]: urls.activityPubRoot(persona.name, serverConfig.url),
        [key.publicKeyPem]: await publicKeyToPem(
          serverConfig.keyPair.publicKey,
        ),
      },
    };
  }

  private localPostToActivity(serverConfig: ServerConfig) {
    const localPostToNote = this.localPostToNote(serverConfig);
    return (post: LocalPost): Activity => ({
      "@id": urls.activityPubPostActivity(
        post.persona,
        post.id,
        serverConfig.url,
      ),
      "@type": key.Create,
      [key.actor]: urls.activityPubRoot(post.persona, serverConfig.url),
      [key.published]: post.createdAt,
      [key.to]: key.Public,
      [key.cc]: urls.activityPubFollowers(post.persona, serverConfig.url),
      [key.object]: localPostToNote(post),
    });
  }

  private localPostToNote(serverConfig: ServerConfig) {
    return (post: LocalPost): Object => ({
      "@id": urls.activityPubPost(post.persona, post.id, serverConfig.url),
      "@type": key.Note,
      [key.url]: urls.localPost(post.id, serverConfig.url),
      [key.attributedTo]: urls.profile(post.persona, serverConfig.url),
      [key.content]: post.content,
      [key.updated]: post.createdAt,
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
      "@id": urls.activityPubOutbox(personaName, serverConfig.url),
      "@type": key.OrderedCollection,

      [key.totalItems]: posts.length,
      [key.items]: {
        "@list": posts.map(this.localPostToActivity(serverConfig)),
      },
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
}
