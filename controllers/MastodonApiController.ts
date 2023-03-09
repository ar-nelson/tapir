import { Injector, Singleton } from "$/lib/inject.ts";
import { ServerConfig, ServerConfigStore } from "$/models/ServerConfig.ts";
import { Persona, PersonaStore } from "$/models/Persona.ts";
import { LocalPost, LocalPostStore } from "$/models/LocalPost.ts";
import { InFollowStore } from "$/models/InFollow.ts";
import { Account, Instance, Status } from "$/schemas/mastodon/mod.ts";
import { asyncToArray } from "$/lib/utils.ts";
import * as urls from "$/lib/urls.ts";
import { log } from "$/deps.ts";

export interface HandlerState {
  injector: Injector;
  controller: MastodonApiController;
}

export enum TimelineFilter {
  LocalAndRemote,
  Local,
  Remote,
}

export interface StatusesOptions {
  onlyMedia?: boolean;
  maxId?: string;
  minId?: string;
  sinceId?: string;
  limit?: number;
}

export interface TimelineOptions extends StatusesOptions {
  filter?: TimelineFilter;
}

export interface AccountStatusesOptions extends StatusesOptions {
  excludeReplies?: boolean;
  excludeReblogs?: boolean;
  pinned?: boolean;
  tagged?: string;
}

@Singleton()
export class MastodonApiController {
  constructor(
    private readonly serverConfigStore: ServerConfigStore,
    private readonly personaStore: PersonaStore,
    private readonly localPostStore: LocalPostStore,
    private readonly inFollowStore: InFollowStore,
  ) {}

  async instance(): Promise<Instance> {
    const serverConfig = await this.serverConfigStore.getServerConfig();

    return {
      uri: serverConfig.domain,
      title: serverConfig.displayName,
      short_description: "tapir",
      description: "tapir tapir tapir",
      email: "adam@nels.onl",
      version: "3.5.3",
      urls: {},
      stats: {
        user_count: await this.personaStore.count(),
        status_count: await this.localPostStore.count(),
        domain_count: 1,
      },
      thumbnail: null,
      languages: [
        "en",
      ],
      registrations: false,
      approval_required: false,
      invites_enabled: false,
      configuration: {
        statuses: {
          max_characters: 500,
          max_media_attachments: 0,
          characters_reserved_per_url: 23,
        },
        media_attachments: {
          supported_mime_types: [],
          image_size_limit: 0,
          image_matrix_limit: 0,
          video_size_limit: 0,
          video_frame_rate_limit: 0,
          video_matrix_limit: 0,
        },
        polls: {
          max_options: 4,
          max_characters_per_option: 50,
          min_expiration: 300,
          max_expiration: 2629746,
        },
      },
      contact_account: await this.#personaToAccount(
        await this.personaStore.getMain(),
        serverConfig,
      ),
      rules: [],
    };
  }

  async publicTimeline(options: TimelineOptions): Promise<Status[]> {
    const serverConfig = await this.serverConfigStore.getServerConfig(),
      posts = await asyncToArray(this.localPostStore.list({
        limit: options.limit ?? 20,
      })),
      personas = new Map<string, Promise<Persona>>();
    return Promise.all(posts.map(async (p) => {
      let persona: Persona;
      if (personas.has(p.persona)) {
        persona = await personas.get(p.persona)!;
      } else {
        const promise = this.personaStore.get(p.persona).then(
          (persona) => {
            if (!persona) {
              throw new Error(`no persona ${JSON.stringify(p.persona)}`);
            }
            return persona;
          },
        );
        personas.set(p.persona, promise);
        persona = await promise;
      }
      return (await this.#localPostToStatus(persona, serverConfig))(p);
    }));
  }

  async account(acct: string): Promise<Account | undefined> {
    const persona = await this.#lookupPersona(acct);
    if (!persona) {
      return undefined;
    }
    return this.#personaToAccount(
      persona,
      await this.serverConfigStore.getServerConfig(),
    );
  }

  async accountStatuses(
    acct: string,
    options: AccountStatusesOptions,
  ): Promise<Status[] | undefined> {
    const persona = await this.#lookupPersona(acct);
    if (!persona) {
      return undefined;
    }
    const serverConfig = await this.serverConfigStore.getServerConfig(),
      posts = await asyncToArray(this.localPostStore.list({
        persona: persona.name,
        limit: options.limit ?? 20,
      }));
    return posts.map(await this.#localPostToStatus(persona, serverConfig));
  }

  async status(id: string): Promise<Status | undefined> {
    const post = await this.localPostStore.get(id);
    if (!post) {
      return undefined;
    }
    const serverConfig = await this.serverConfigStore.getServerConfig(),
      persona = await this.personaStore.get(post.persona);
    if (!persona) {
      return undefined;
    }
    return (await this.#localPostToStatus(persona, serverConfig))(post);
  }

  async #lookupPersona(name: string): Promise<Persona | undefined> {
    const serverConfig = await this.serverConfigStore.getServerConfig(),
      nameMatch = /^[@]?([^@:]+)(?:[@]([^@:]+))?$/.exec(name);
    if (!nameMatch || (nameMatch[2] && nameMatch[2] !== serverConfig.domain)) {
      log.warning(
        `not a valid account for this server: ${JSON.stringify(name)}`,
      );
      return undefined;
    }
    const persona = await this.personaStore.get(nameMatch[1]);
    if (!persona) {
      log.warning(`account does not exist: ${JSON.stringify(nameMatch[1])}`);
      return undefined;
    }
    return persona;
  }

  async #personaToAccount(
    persona: Persona,
    serverConfig: ServerConfig,
  ): Promise<Account> {
    return {
      id: persona.name,
      username: persona.name,
      acct: persona.name,
      display_name: persona.displayName,
      locked: true,
      bot: false,
      discoverable: true,
      group: false,
      created_at: persona.createdAt.toJSON(),
      note: "",
      url: urls.localProfile(persona.name, {}, serverConfig.url),
      avatar: urls.urlJoin(serverConfig.url, "tapir-avatar.jpg"),
      avatar_static: urls.urlJoin(serverConfig.url, "tapir-avatar.jpg"),
      header: "",
      header_static: "",
      followers_count: await this.inFollowStore.countFollowers(persona.name),
      following_count: 0,
      statuses_count: await this.localPostStore.count(persona.name),
      last_status_at: persona.createdAt.toJSON(),
      emojis: [],
      fields: [],
    };
  }

  async #localPostToStatus(persona: Persona, serverConfig: ServerConfig) {
    const account = await this.#personaToAccount(persona, serverConfig);
    return (post: LocalPost): Status => ({
      id: post.id,
      created_at: post.createdAt.toJSON(),
      in_reply_to_id: null,
      in_reply_to_account_id: null,
      sensitive: !!post.collapseSummary,
      spoiler_text: post.collapseSummary ?? "",
      visibility: "public",
      language: "en",
      uri: urls.localPost(post.id, {}, serverConfig.url),
      url: urls.localPost(post.id, {}, serverConfig.url),
      replies_count: 0,
      reblogs_count: 0,
      favourites_count: 0,
      edited_at: null,
      content: post.content ?? "",
      reblog: null,
      application: {
        name: "Tapir",
        website: "https://tapir.social",
      },
      account,
      media_attachments: [],
      mentions: [],
      tags: [],
      emojis: [],
      card: null,
      poll: null,
    });
  }
}
