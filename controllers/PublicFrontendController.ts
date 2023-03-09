import { LocalPost, LocalPostStore } from "$/models/LocalPost.ts";
import { ServerConfigStore } from "$/models/ServerConfig.ts";
import { Persona, PersonaStore } from "$/models/Persona.ts";
import { InFollowStore } from "$/models/InFollow.ts";
import { LocalAttachmentStore } from "$/models/LocalAttachment.ts";
import {
  FollowDetail,
  PostDetail,
  ProfileDetail,
  ServerDetail,
} from "$/views/types.ts";
import { Singleton } from "$/lib/inject.ts";
import { asyncToArray } from "$/lib/utils.ts";
import { View } from "$/lib/html.ts";
import * as urls from "$/lib/urls.ts";

const PAGE_SIZE = 20;

@Singleton()
export class PublicFrontendController {
  constructor(
    private readonly serverConfigStore: ServerConfigStore,
    private readonly personaStore: PersonaStore,
    private readonly localPostStore: LocalPostStore,
    private readonly inFollowStore: InFollowStore,
    private readonly localAttachmentStore: LocalAttachmentStore,
  ) {}

  async serverDetail(): Promise<ServerDetail> {
    const serverConfig = await this.serverConfigStore.getServerConfig(),
      personas = await asyncToArray(this.personaStore.list());
    return {
      name: serverConfig.displayName,
      summary: serverConfig.summary,
      links: personas.map((p) => ({
        name: p.linkTitle ?? p.displayName,
        url: urls.localProfile(p.name, {}),
      })),
    };
  }

  async #personaDetail(persona: Persona): Promise<ProfileDetail> {
    return {
      url: urls.localProfile(persona.name, {}),
      name: `@${persona.name}`,
      displayName: persona.displayName,
      avatarUrl: "/static/tapir-avatar.jpg",
      summary: persona.summary,
      posts: await this.localPostStore.count(persona.name),
      followers: await this.inFollowStore.countFollowers(persona.name),
      following: 0,
      createdAt: persona.createdAt,
    };
  }

  async #localPostDetail(
    post: LocalPost,
    persona: Persona,
  ): Promise<PostDetail> {
    const attachments = await asyncToArray(
      this.localAttachmentStore.list(post.id),
    );
    return {
      id: post.id,
      url: urls.localPost(post.id, {}),
      type: post.type,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      content: post.content == null ? undefined : new View(() => post.content!), // TODO: sanitize html
      collapseSummary: post.collapseSummary,
      replyTo: post.replyTo,
      author: {
        name: `@${persona.name}`,
        displayName: persona.displayName,
        url: urls.localProfile(persona.name, {}),
        avatarUrl: "/static/tapir-avatar.jpg",
      },
      likes: 0,
      boosts: 0,
      replies: 0,
      liked: false,
      boosted: false,
      attachments: attachments.map((a) => ({
        url: urls.localMedia(a.original),
        type: a.type,
        alt: a.alt ?? undefined,
      })),
    };
  }

  async instanceFeed(beforeId?: string): Promise<{
    server: ServerDetail;
    posts: PostDetail[];
  }> {
    const posts = await asyncToArray(
      this.localPostStore.list({ beforeId, limit: PAGE_SIZE }),
    );
    return {
      server: await this.serverDetail(),
      posts: await Promise.all(
        posts.map(async (p) =>
          this.#localPostDetail(p, (await this.personaStore.get(p.persona))!)
        ),
      ),
    };
  }

  async personaFeed(personaName: string, beforeId?: string): Promise<
    {
      server: ServerDetail;
      profile: ProfileDetail;
      posts: PostDetail[];
    } | null
  > {
    const persona = await this.personaStore.get(personaName);
    if (!persona) return null;
    const posts = await asyncToArray(
      this.localPostStore.list({
        persona: personaName,
        beforeId,
        limit: PAGE_SIZE,
      }),
    );
    return {
      server: await this.serverDetail(),
      profile: await this.#personaDetail(persona),
      posts: await Promise.all(
        posts.map((p) => this.#localPostDetail(p, persona!)),
      ),
    };
  }

  async post(
    id: string,
    _afterReplyDate?: Date,
  ): Promise<
    { server: ServerDetail; posts: PostDetail[]; selectedPost: string } | null
  > {
    const post = await this.localPostStore.get(id);
    if (!post) return null;
    const persona = await this.personaStore.get(post.persona);
    if (!persona) return null;
    return {
      server: await this.serverDetail(),
      posts: [await this.#localPostDetail(post, persona)],
      selectedPost: id,
    };
  }

  async followers(
    personaName: string,
  ): Promise<
    | {
      server: ServerDetail;
      profile: ProfileDetail;
      followers: FollowDetail[];
    }
    | null
  > {
    const persona = await this.personaStore.get(personaName);
    if (!persona) return null;
    const followers = await asyncToArray(
      this.inFollowStore.listFollowers(personaName),
    );
    return {
      server: await this.serverDetail(),
      profile: await this.#personaDetail(persona),
      followers: followers.map((f) => ({
        url: f.actor,
        name: `${f.name}@${new URL(f.server).host}`,
        displayName: f.name,
        avatarUrl: "",
      })),
    };
  }

  async following(
    personaName: string,
  ): Promise<
    | {
      server: ServerDetail;
      profile: ProfileDetail;
      followers: FollowDetail[];
    }
    | null
  > {
    const persona = await this.personaStore.get(personaName);
    if (!persona) return null;
    return {
      server: await this.serverDetail(),
      profile: await this.#personaDetail(persona),
      followers: [],
    };
  }
}
