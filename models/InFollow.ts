import { InjectableAbstract, Singleton } from "$/lib/inject.ts";
import * as urls from "$/lib/urls.ts";
import { DatabaseService } from "$/services/DatabaseService.ts";
import { ActivityDispatcher, Priority } from "$/services/ActivityDispatcher.ts";
import { LocalDatabaseSpec } from "$/schemas/tapir/LocalDatabase.ts";
import { Actor, ActorSchema } from "$/schemas/activitypub/mod.ts";
import { LocalActivityStore } from "$/models/LocalActivity.ts";
import { LocalPostStore } from "$/models/LocalPost.ts";
import { ServerConfigStore } from "$/models/ServerConfig.ts";
import { KnownServerStore } from "$/models/KnownServer.ts";
import { PersonaStoreReadOnly } from "$/models/Persona.ts";
import { matchesSchema } from "https://deno.land/x/spartanschema@v1.0.1/mod.ts";
import * as log from "https://deno.land/std@0.176.0/log/mod.ts";
import {
  InFollowStoreReadOnly,
  InFollowStoreReadOnlyImpl,
} from "./InFollowStoreReadOnly.ts";
export * from "./InFollowStoreReadOnly.ts";

export enum InFollowErrorType {
  BadPersona,
  BadActor,
  DuplicateFollow,
}

export class InFollowError extends Error {
  constructor(public readonly type: InFollowErrorType, message: string) {
    super(message);
  }
}

@InjectableAbstract()
export abstract class InFollowStore extends InFollowStoreReadOnly {
  constructor(private readonly base: InFollowStoreReadOnly) {
    super();
  }

  listFollowers(persona: string) {
    return this.base.listFollowers(persona);
  }

  listRequests(persona: string) {
    return this.base.listRequests(persona);
  }

  listFollowerInboxes(persona: string) {
    return this.base.listFollowerInboxes(persona);
  }

  get(params: { id: string } | { actor: string; persona: string }) {
    return this.base.get(params);
  }

  countFollowers(persona: string) {
    return this.base.countFollowers(persona);
  }

  countRequests(persona: string) {
    return this.base.countRequests(persona);
  }

  abstract create(
    params: { id: string; actor: string; persona: string },
  ): Promise<void>;

  abstract accept(
    params: { id: string } | { actor: string; persona: string },
  ): Promise<void>;

  abstract reject(
    params: { id: string } | { actor: string; persona: string },
  ): Promise<void>;

  abstract delete(
    params: { id: string } | { actor: string; persona: string },
  ): Promise<void>;
}

const isActor = matchesSchema(ActorSchema);

@Singleton(InFollowStore)
export class InFollowStoreImpl extends InFollowStore {
  readonly #serverConfig;

  constructor(
    private readonly db: DatabaseService<typeof LocalDatabaseSpec>,
    private readonly knownServerStore: KnownServerStore,
    private readonly localActivityStore: LocalActivityStore,
    private readonly localPostStore: LocalPostStore,
    private readonly personaStore: PersonaStoreReadOnly,
    private readonly activityDispatcher: ActivityDispatcher,
    serverConfigStore: ServerConfigStore,
    private readonly _base: InFollowStoreReadOnlyImpl,
  ) {
    super(_base);
    this.#serverConfig = serverConfigStore.getServerConfig();
  }

  async create(
    params: { id: string; actor: string; persona: string },
  ): Promise<void> {
    const persona = await this.personaStore.get(params.persona);
    if (persona == null) {
      throw new InFollowError(
        InFollowErrorType.BadPersona,
        `Cannot add follow for nonexistent persona ${
          JSON.stringify(params.persona)
        }`,
      );
    }
    let actorUrl: URL, actor: Actor;
    try {
      actorUrl = new URL(params.actor);
      actor = await this.activityDispatcher.request(
        actorUrl,
        params.persona,
        Priority.Soon,
      ) as Actor;
    } catch (e) {
      log.error(`Failed to fetch actor at ${params.actor}:`);
      log.error(e);
      throw new InFollowError(
        InFollowErrorType.BadActor,
        `Failed to fetch actor at ${params.actor}: ${e?.message ?? e}`,
      );
    }
    if (!isActor(actor)) {
      throw new InFollowError(
        InFollowErrorType.BadActor,
        `JSON at ${params.actor} was not a valid ActivityPub Actor`,
      );
    }
    log.info(`New follow from ${params.actor} to persona ${params.persona}`);
    this.knownServerStore.seen(actorUrl, actor.endpoints?.sharedInbox);
    const now = new Date();
    await this.db.transaction(async (t) => {
      for await (
        const { createdAt } of t.get("inFollow", {
          where: { actor: params.actor, persona: params.persona },
          limit: 1,
          returning: ["createdAt"],
        })
      ) {
        throw new InFollowError(
          InFollowErrorType.DuplicateFollow,
          `Follow from ${params.actor} -> ${params.persona} already exists (at ${createdAt})`,
        );
      }
      await t.insert("inFollow", [{
        ...params,
        name: actor.preferredUsername,
        inbox: actor.inbox,
        server: `${actorUrl.protocol}//${actorUrl.host}`,
        createdAt: now,
        acceptedAt: persona.requestToFollow ? null : now,
      }]);
    });
    if (!persona.requestToFollow) {
      this.#onAccept(params.id, params.persona, params.actor, actor.inbox, now);
    }
  }

  async #onAccept(
    id: string,
    persona: string,
    actor: string,
    inbox: string,
    now: Date,
  ) {
    this.localActivityStore.create({
      type: "Accept",
      actor: urls.activityPubActor(persona, (await this.#serverConfig).url),
      published: now.toJSON(),
      to: actor,
      object: id,
    }, persona);
    this._base.expireFollowerInboxes();
    for await (
      const post of this.localPostStore.list({ persona, order: "ASC" })
    ) {
      // TODO: Handle posts with limited visibility
      const activity = await this.localActivityStore.get(post.id);
      if (activity) {
        this.activityDispatcher.dispatchTo(
          new URL(inbox),
          activity.json,
          persona,
        );
      }
    }
  }

  async accept(
    params: { id: string } | { actor: string; persona: string },
  ): Promise<void> {
    const existing = await this.get(params);
    if (existing == null || existing.acceptedAt) {
      throw new Error(
        `No existing follow request matches ${JSON.stringify(params)}`,
      );
    }
    const now = new Date();
    await this.db.update("inFollow", { id: existing.id }, { acceptedAt: now });
    this.#onAccept(
      existing.id,
      existing.persona,
      existing.actor,
      existing.inbox,
      now,
    );
  }

  async reject(
    params: { id: string } | { actor: string; persona: string },
  ): Promise<void> {
    const existing = await this.get(params);
    if (existing == null) {
      throw new Error(
        `No existing follow request matches ${JSON.stringify(params)}`,
      );
    }
    await this.db.delete("inFollow", params);
    this.localActivityStore.create({
      type: "Reject",
      actor: urls.activityPubActor(
        existing.persona,
        (await this.#serverConfig).url,
      ),
      published: new Date().toJSON(),
      to: existing.actor,
      object: existing.id,
    }, existing.persona);
  }

  async delete(
    params: { id: string } | { actor: string; persona: string },
  ): Promise<void> {
    const existing = await this.get(params);
    if (existing == null) {
      throw new Error(
        `No existing follow request matches ${JSON.stringify(params)}`,
      );
    }
    await this.db.delete("inFollow", params);
  }
}
