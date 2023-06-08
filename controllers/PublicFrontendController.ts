import { datetime } from "$/lib/datetime/mod.ts";
import { View } from "$/lib/html.ts";
import { Singleton } from "$/lib/inject.ts";
import { chainFrom } from "$/lib/transducers.ts";
import * as urls from "$/lib/urls.ts";
import { InFollowStore } from "$/models/InFollow.ts";
import { InstanceConfigStore } from "$/models/InstanceConfig.ts";
import { LocalAttachmentStore } from "$/models/LocalAttachment.ts";
import { LocalPostStore } from "$/models/LocalPost.ts";
import { PersonaStore } from "$/models/Persona.ts";
import { RemoteProfileStore } from "$/models/RemoteProfile.ts";
import { LocalPost, Persona, Protocol } from "$/models/types.ts";
import {
  PostDetail,
  ProfileCardDetail,
  ProfileDetail,
  ServerDetail,
} from "$/views/types.ts";

const PAGE_SIZE = 20;

@Singleton()
export class PublicFrontendController {
  constructor(
    private readonly instanceConfigStore: InstanceConfigStore,
    private readonly personaStore: PersonaStore,
    private readonly localPostStore: LocalPostStore,
    private readonly inFollowStore: InFollowStore,
    private readonly localAttachmentStore: LocalAttachmentStore,
    private readonly remoteProfileStore: RemoteProfileStore,
  ) {}

  async serverDetail(): Promise<ServerDetail> {
    const instanceConfig = await this.instanceConfigStore.get(),
      personas = await chainFrom(this.personaStore.list()).toArray();
    return {
      name: instanceConfig.displayName,
      summary: new View(() => instanceConfig.summary),
      links: personas.map((p) => ({
        name: p.linkTitle ?? p.displayName ?? p.name,
        url: urls.localProfile(p.name, {}),
      })),
    };
  }

  async #personaDetail(persona: Persona): Promise<ProfileDetail> {
    return {
      url: urls.localProfile(persona.name, {}),
      name: `@${persona.name}`,
      displayName: persona.displayName,
      addr: { protocol: Protocol.Local, path: persona.name },
      type: persona.type,
      avatarUrl: "/static/tapir-avatar.jpg",
      summary: persona.summaryHtml,
      postCount: await this.localPostStore.count(persona.name),
      followerCount: await this.inFollowStore.countFollowers(persona.name),
      followingCount: 0,
      createdAt: persona.createdAt && datetime(persona.createdAt),
    };
  }

  async #localPostDetail(
    post: LocalPost,
    persona: Persona,
  ): Promise<PostDetail> {
    return {
      addr: { protocol: Protocol.Local, path: post.id },
      url: urls.localPost(post.id, {}),
      type: post.type,
      createdAt: post.createdAt && datetime(post.createdAt),
      updatedAt: post.updatedAt && datetime(post.updatedAt),
      content: post.contentHtml, // TODO: sanitize html
      contentWarning: post.contentWarning,
      //replyTo: post.replyTo,
      author: {
        name: `@${persona.name}`,
        displayName: persona.displayName,
        url: urls.localProfile(persona.name, {}),
        avatarUrl: "/static/tapir-avatar.jpg",
        addr: { protocol: Protocol.Local, path: persona.name },
        type: persona.type,
      },
      attachments: await chainFrom(
        this.localAttachmentStore.list(post.id),
      ).map((a) => ({
        url: urls.localMedia(a.original),
        type: a.type,
        alt: a.alt ?? undefined,
      })).toArray(),
      actions: {
        like: {
          enabled: false,
          count: 0,
          you: false,
        },
        boost: {
          enabled: false,
          count: 0,
          you: false,
        },
        reply: {
          enabled: false,
          count: 0,
        },
      },
    };
  }

  async instanceFeed(beforeId?: string): Promise<{
    server: ServerDetail;
    posts: PostDetail[];
  }> {
    return {
      server: await this.serverDetail(),
      posts: await chainFrom(
        this.localPostStore.list({ beforeId, limit: PAGE_SIZE }),
      ).mapAsync(async (p) =>
        this.#localPostDetail(p, await this.personaStore.get(p.persona))
      ).toArray(),
    };
  }

  async personaFeed(personaName: string, beforeId?: string): Promise<
    {
      server: ServerDetail;
      profile: ProfileDetail;
      posts: PostDetail[];
    }
  > {
    const persona = await this.personaStore.get(personaName);
    return {
      server: await this.serverDetail(),
      profile: await this.#personaDetail(persona),
      posts: await chainFrom(
        this.localPostStore.list({
          persona: personaName,
          beforeId,
          limit: PAGE_SIZE,
        }),
      ).mapAsync((p) => this.#localPostDetail(p, persona)).toArray(),
    };
  }

  async post(
    id: string,
    _afterReplyDate?: Date,
  ): Promise<
    { server: ServerDetail; posts: PostDetail[]; selectedPost: string }
  > {
    const post = await this.localPostStore.get(id),
      persona = await this.personaStore.get(post.persona);
    return {
      server: await this.serverDetail(),
      posts: [await this.#localPostDetail(post, persona)],
      selectedPost: id,
    };
  }

  async followers(
    personaName: string,
  ): Promise<
    {
      server: ServerDetail;
      profile: ProfileDetail;
      followers: ProfileCardDetail[];
    }
  > {
    const persona = await this.personaStore.get(personaName);
    return {
      server: await this.serverDetail(),
      profile: await this.#personaDetail(persona),
      followers: await chainFrom(
        this.inFollowStore.listFollowers(personaName),
      ).mapAsync(async ({ remoteProfile }) => {
        const f = await this.remoteProfileStore.get(remoteProfile);
        return {
          addr: f.addr,
          type: f.type,
          url: f.url ?? undefined,
          name: f.name,
          displayName: f.displayName ?? f.name,
          avatarUrl: "",
        };
      }).toArray(),
    };
  }

  async following(
    personaName: string,
  ): Promise<
    {
      server: ServerDetail;
      profile: ProfileDetail;
      followers: ProfileCardDetail[];
    }
  > {
    const persona = await this.personaStore.get(personaName);
    return {
      server: await this.serverDetail(),
      profile: await this.#personaDetail(persona),
      followers: [],
    };
  }
}
