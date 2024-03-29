import { Injector, Singleton } from "$/lib/inject.ts";
import { chainFrom } from "$/lib/transducers.ts";
import * as urls from "$/lib/urls.ts";
import { InFollowStore } from "$/models/InFollow.ts";
import { InstanceConfigStore } from "$/models/InstanceConfig.ts";
import { LocalPostStore } from "$/models/LocalPost.ts";
import { PersonaNotFound, PersonaStore } from "$/models/Persona.ts";
import { TapirConfig } from "$/models/TapirConfig.ts";
import { LocalPost, Persona } from "$/models/types.ts";
import buildMeta from "$/resources/buildMeta.json" assert { type: "json" };
import { Account, Instance, Status } from "$/schemas/mastodon/mod.ts";

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
    private readonly config: TapirConfig,
    private readonly instanceConfigStore: InstanceConfigStore,
    private readonly personaStore: PersonaStore,
    private readonly localPostStore: LocalPostStore,
    private readonly inFollowStore: InFollowStore,
  ) {}

  async instance(): Promise<Instance> {
    const instanceConfig = await this.instanceConfigStore.get();

    return {
      uri: this.config.domain,
      title: instanceConfig.displayName,
      short_description: `${buildMeta.name} v${buildMeta.version}`,
      description: instanceConfig.summary,
      email: instanceConfig.adminEmail,
      version: "3.5.3",
      urls: {},
      stats: {
        user_count: await this.personaStore.count(),
        status_count: await this.localPostStore.count(),
        domain_count: 1,
      },
      thumbnail: instanceConfig.logo
        ? urls.localMedia(instanceConfig.logo, this.config.url)
        : null,
      languages: [
        "en",
      ],
      registrations: false,
      approval_required: false,
      invites_enabled: false,
      configuration: {
        statuses: {
          max_characters: instanceConfig.maxCharacters,
          max_media_attachments: instanceConfig.maxMediaAttachments,
          characters_reserved_per_url: 23,
        },
        media_attachments: {
          supported_mime_types: [
            "image/jpeg",
            "image/png",
            "image/gif",
            "image/webp",
          ],
          image_size_limit: instanceConfig.maxImageBytes,
          image_matrix_limit: instanceConfig.maxImagePixels,
          video_size_limit: instanceConfig.maxVideoBytes,
          video_matrix_limit: instanceConfig.maxVideoPixels,
          video_frame_rate_limit: instanceConfig.maxVideoFramerate,
        },
        polls: {
          max_options: 16,
          max_characters_per_option: 256,
          min_expiration: 300,
          max_expiration: 2629746,
        },
      },
      contact_account: await this.#personaToAccount(
        await this.personaStore.getMain(),
      ),
      rules: [],
    };
  }

  publicTimeline(options: TimelineOptions): Promise<Status[]> {
    const personas = new Map<string, Promise<Persona>>();
    return chainFrom(this.localPostStore.list({
      limit: options.limit ?? 20,
    })).mapAsync(async (p) => {
      let persona: Persona;
      if (personas.has(p.persona)) {
        persona = await personas.get(p.persona)!;
      } else {
        const promise = this.personaStore.get(p.persona);
        personas.set(p.persona, promise);
        persona = await promise;
      }
      return (await this.#localPostToStatus(persona))(p);
    }).toArray();
  }

  async account(acct: string): Promise<Account> {
    return this.#personaToAccount(await this.#lookupPersona(acct));
  }

  async accountStatuses(
    acct: string,
    options: AccountStatusesOptions,
  ): Promise<Status[]> {
    const persona = await this.#lookupPersona(acct);
    return chainFrom(this.localPostStore.list({
      persona: persona.name,
      limit: options.limit ?? 20,
    })).map(await this.#localPostToStatus(persona)).toArray();
  }

  async status(id: string): Promise<Status> {
    const post = await this.localPostStore.get(id),
      persona = await this.personaStore.get(post.persona);
    return (await this.#localPostToStatus(persona))(post);
  }

  #lookupPersona(name: string): Promise<Persona> {
    const nameMatch = /^[@]?([^@:]+)(?:[@]([^@:]+))?$/.exec(name);
    if (!nameMatch || (nameMatch[2] && nameMatch[2] !== this.config.domain)) {
      throw PersonaNotFound.error(
        `Not a valid account for this server: ${JSON.stringify(name)}`,
      );
    }
    return this.personaStore.get(nameMatch[1]);
  }

  async #personaToAccount(persona: Persona): Promise<Account> {
    return {
      id: persona.name,
      username: persona.name,
      acct: persona.name,
      display_name: persona.displayName ?? persona.name,
      locked: true,
      bot: false,
      discoverable: true,
      group: false,
      created_at: persona.createdAt.toJSON(),
      note: "",
      url: urls.localProfile(persona.name, {}, this.config.url),
      avatar: urls.urlJoin(this.config.url, "tapir-avatar.jpg"),
      avatar_static: urls.urlJoin(this.config.url, "tapir-avatar.jpg"),
      header: "",
      header_static: "",
      followers_count: await this.inFollowStore.countFollowers(persona.name),
      following_count: 0,
      statuses_count: await this.localPostStore.count(persona.name),
      last_status_at: (await this.localPostStore.list({
        persona: persona.name,
        limit: 1,
        order: "DESC",
      })[Symbol.asyncIterator]().next()).value?.createdAt?.toJSON() ?? null,
      emojis: [],
      fields: [],
    };
  }

  async #localPostToStatus(persona: Persona) {
    const account = await this.#personaToAccount(persona);
    return (post: LocalPost): Status => ({
      id: post.id,
      created_at: post.createdAt.toJSON(),
      in_reply_to_id: null,
      in_reply_to_account_id: null,
      sensitive: !!post.contentWarning,
      spoiler_text: post.contentWarning ?? "",
      visibility: "public",
      language: "en",
      uri: urls.localPost(post.id, {}, this.config.url),
      url: urls.localPost(post.id, {}, this.config.url),
      replies_count: 0,
      reblogs_count: 0,
      favourites_count: 0,
      edited_at: post.updatedAt?.toJSON() ?? null,
      content: post.contentHtml ?? "",
      reblog: null,
      application: {
        name: buildMeta.name,
        website: buildMeta.homepageUrl,
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
