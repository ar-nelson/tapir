import { Singleton } from "$/lib/inject.ts";
import { ServerConfig, ServerConfigStore } from "$/models/ServerConfig.ts";
import { Persona, PersonaStore } from "$/models/Persona.ts";
import { LocalPost, LocalPostStore } from "$/models/LocalPost.ts";
import { Account, Instance, Status } from "$/schemas/mastodon/mod.ts";
import * as urls from "$/lib/urls.ts";
import * as log from "https://deno.land/std@0.176.0/log/mod.ts";

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
export class MastodonApiService {
  constructor(
    private readonly serverConfigStore: ServerConfigStore,
    private readonly personaStore: PersonaStore,
    private readonly localPostStore: LocalPostStore,
  ) {}

  async instance(): Promise<Instance> {
    const serverConfig = await this.serverConfigStore.getServerConfig(),
      personas = await this.personaStore.listPersonas(),
      posts = await this.localPostStore.listPosts();

    return {
      "uri": serverConfig.domain,
      "title": "Tapir",
      "short_description": "tapir",
      "description": "tapir tapir tapir",
      "email": "adam@nels.onl",
      "version": "3.5.3",
      "urls": {},
      "stats": {
        "user_count": personas.length,
        "status_count": posts.length,
        "domain_count": 1,
      },
      "thumbnail": null,
      "languages": [
        "en",
      ],
      "registrations": false,
      "approval_required": false,
      "invites_enabled": false,
      "configuration": {
        "statuses": {
          "max_characters": 500,
          "max_media_attachments": 0,
          "characters_reserved_per_url": 23,
        },
        "media_attachments": {
          "supported_mime_types": [],
          "image_size_limit": 0,
          "image_matrix_limit": 0,
          "video_size_limit": 0,
          "video_frame_rate_limit": 0,
          "video_matrix_limit": 0,
        },
        "polls": {
          "max_options": 4,
          "max_characters_per_option": 50,
          "min_expiration": 300,
          "max_expiration": 2629746,
        },
      },
      "contact_account": this.personaToAccount(personas[0], serverConfig),
      "rules": [],
    };
  }

  async publicTimeline(options: TimelineOptions): Promise<Status[]> {
    const serverConfig = await this.serverConfigStore.getServerConfig(),
      posts = await this.localPostStore.listPosts(
        undefined,
        options.limit ?? 20,
      ),
      personas = new Map<string, Promise<Persona>>();
    return Promise.all(posts.map(async (p) => {
      let persona: Persona;
      if (personas.has(p.persona)) {
        persona = await personas.get(p.persona)!;
      } else {
        const promise = this.personaStore.getPersona(p.persona).then(
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
      return this.localPostToStatus(persona, serverConfig)(p);
    }));
  }

  private async lookupPersona(name: string): Promise<Persona | undefined> {
    const serverConfig = await this.serverConfigStore.getServerConfig(),
      nameMatch = /^[@]?([^@:]+)(?:[@]([^@:]+))?$/.exec(name);
    if (!nameMatch || (nameMatch[2] && nameMatch[2] !== serverConfig.domain)) {
      log.info(
        `not a valid account for this server: ${JSON.stringify(name)}`,
      );
      return undefined;
    }
    const persona = await this.personaStore.getPersona(nameMatch[1]);
    if (!persona) {
      log.info(`account does not exist: ${JSON.stringify(nameMatch[1])}`);
      return undefined;
    }
    return persona;
  }

  async account(acct: string): Promise<Account | undefined> {
    const persona = await this.lookupPersona(acct);
    if (!persona) {
      return undefined;
    }
    return this.personaToAccount(
      persona,
      await this.serverConfigStore.getServerConfig(),
    );
  }

  async accountStatuses(
    acct: string,
    options: AccountStatusesOptions,
  ): Promise<Status[] | undefined> {
    const persona = await this.lookupPersona(acct);
    if (!persona) {
      return undefined;
    }
    const serverConfig = await this.serverConfigStore.getServerConfig(),
      posts = await this.localPostStore.listPosts(
        persona.name,
        options.limit ?? 20,
      );
    return posts.map(this.localPostToStatus(persona, serverConfig));
  }

  async status(id: string): Promise<Status | undefined> {
    const post = await this.localPostStore.getPost(id);
    if (!post) {
      return undefined;
    }
    const serverConfig = await this.serverConfigStore.getServerConfig(),
      persona = await this.personaStore.getPersona(post.persona);
    if (!persona) {
      return undefined;
    }
    return this.localPostToStatus(persona, serverConfig)(post);
  }

  private personaToAccount(
    persona: Persona,
    serverConfig: ServerConfig,
  ): Account {
    return {
      id: persona.name,
      username: persona.name,
      acct: persona.name,
      display_name: persona.displayName,
      locked: true,
      bot: false,
      discoverable: true,
      group: false,
      created_at: persona.createdAt,
      note: "",
      url: urls.profile(persona.name, serverConfig.url),
      avatar: urls.urlJoin(serverConfig.url, "tapir-avatar.jpg"),
      avatar_static: urls.urlJoin(serverConfig.url, "tapir-avatar.jpg"),
      header: "",
      header_static: "",
      followers_count: 0,
      following_count: 0,
      statuses_count: 0,
      last_status_at: persona.createdAt,
      emojis: [],
      fields: [],
    };
  }

  private localPostToStatus(persona: Persona, serverConfig: ServerConfig) {
    const account = this.personaToAccount(persona, serverConfig);
    return (post: LocalPost): Status => ({
      id: post.id,
      created_at: post.createdAt,
      in_reply_to_id: null,
      in_reply_to_account_id: null,
      sensitive: false,
      spoiler_text: "",
      visibility: "public",
      language: "en",
      uri: urls.localPost(post.id, serverConfig.url),
      url: urls.localPost(post.id, serverConfig.url),
      replies_count: 0,
      reblogs_count: 0,
      favourites_count: 0,
      edited_at: null,
      content: post.content,
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
