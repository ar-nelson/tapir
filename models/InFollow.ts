import { log } from "$/deps.ts";
import { InjectableAbstract, Singleton } from "$/lib/inject.ts";
import { Q } from "$/lib/sql/mod.ts";
import { ActivityDispatchStore } from "$/models/ActivityDispatch.ts";
import { KnownActorStore } from "$/models/KnownActor.ts";
import { KnownServerStoreReadOnly } from "$/models/KnownServer.ts";
import { PersonaStoreReadOnly } from "$/models/PersonaStoreReadOnly.ts";
import { ActivityPubGeneratorService } from "$/services/ActivityPubGeneratorService.ts";
import { LocalDatabaseService } from "$/services/LocalDatabaseService.ts";

export interface InFollow {
  readonly id: string;
  readonly actor: string;
  readonly persona: string;
  readonly createdAt: Date;
  readonly acceptedAt: Date | null;
}

@InjectableAbstract()
export abstract class InFollowStore {
  abstract listFollowers(persona: string): AsyncIterable<InFollow>;

  abstract listRequests(persona: string): AsyncIterable<InFollow>;

  abstract get(
    params: { id: string } | { actor: string; persona: string },
  ): Promise<InFollow | null>;

  abstract countFollowers(persona: string): Promise<number>;

  abstract countRequests(persona: string): Promise<number>;

  abstract listFollowerInboxes(persona: string): Promise<URL[]>;

  abstract onAccept(fn: (follow: InFollow) => void): void;

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

  abstract deleteAllForPersona(persona: string): Promise<void>;
}

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

@Singleton(InFollowStore)
export class InFollowStoreImpl extends InFollowStore {
  readonly #onAcceptListeners = new Set<(follow: InFollow) => void>();
  #followerInboxSet: Promise<URL[]> | null = null;

  constructor(
    private readonly db: LocalDatabaseService,
    private readonly apGen: ActivityPubGeneratorService,
    private readonly knownServerStore: KnownServerStoreReadOnly,
    private readonly knownActorStore: KnownActorStore,
    private readonly activityDispatchStore: ActivityDispatchStore,
    private readonly personaStore: PersonaStoreReadOnly,
  ) {
    super();
  }

  listFollowers(persona: string): AsyncIterable<InFollow> {
    return this.db.get("inFollow", {
      where: { acceptedAt: Q.notNull(), persona },
    });
  }

  listRequests(persona: string): AsyncIterable<InFollow> {
    return this.db.get("inFollow", {
      where: { acceptedAt: Q.null(), persona },
    });
  }

  listFollowerInboxes(persona: string): Promise<URL[]> {
    if (this.#followerInboxSet) return this.#followerInboxSet;
    return this.#followerInboxSet = (async () => {
      const inboxen = new Set<string>(), skipServers = new Set<string>();
      for await (const { actor: url } of this.listFollowers(persona)) {
        const actor = await this.knownActorStore.get(new URL(url));
        if (!actor) {
          log.warning(`No known actor with URL ${url}`);
          continue;
        }
        const { server, inbox } = actor;
        if (skipServers.has(server)) continue;
        console.log(server);
        const knownServer = await this.knownServerStore.get(new URL(server));
        if (knownServer && knownServer.sharedInbox) {
          inboxen.add(knownServer.sharedInbox);
          skipServers.add(server);
        } else {
          inboxen.add(inbox);
        }
      }
      return [...inboxen].map((s) => new URL(s));
    })();
  }

  async get(
    params: { id: string } | { actor: string; persona: string },
  ): Promise<InFollow | null> {
    for await (
      const p of this.db.get("inFollow", { where: params, limit: 1 })
    ) {
      return p;
    }
    return null;
  }

  countFollowers(persona: string): Promise<number> {
    return this.db.count("inFollow", { acceptedAt: Q.notNull(), persona });
  }

  countRequests(persona: string): Promise<number> {
    return this.db.count("inFollow", { acceptedAt: Q.null(), persona });
  }

  expireFollowerInboxes() {
    this.#followerInboxSet = null;
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
    let actorUrl: URL;
    try {
      actorUrl = new URL(params.actor);
    } catch {
      throw new InFollowError(
        InFollowErrorType.BadActor,
        `Not a valid actor ID URL: ${params.actor}`,
      );
    }
    const actor = await this.knownActorStore.fetch(actorUrl, params.persona);
    if (!actor) {
      throw new InFollowError(
        InFollowErrorType.BadActor,
        `Actor does not exist or is not valid: ${params.actor}`,
      );
    }
    log.info(`New follow from ${params.actor} to persona ${params.persona}`);
    const now = new Date(),
      follow = await this.db.transaction(async (t) => {
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
        const follow = {
          ...params,
          createdAt: now,
          acceptedAt: persona.requestToFollow ? null : now,
        };
        await t.insert("inFollow", [follow]);
        return follow;
      });
    if (!persona.requestToFollow) {
      this.#onAccept(new URL(actor.inbox), follow);
    }
  }

  onAccept(listener: (follow: InFollow) => void): void {
    this.#onAcceptListeners.add(listener);
  }

  #onAccept(inbox: URL, follow: InFollow) {
    this.activityDispatchStore.createAndDispatch(
      inbox,
      this.apGen.directActivity(follow.persona, follow.actor, {
        type: "Accept",
        createdAt: follow.createdAt,
        object: follow.id,
      }),
    );
    this.expireFollowerInboxes();
    this.#onAcceptListeners.forEach((l) => l(follow));
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
    const { inbox } =
      (await this.knownActorStore.get(new URL(existing.actor)))!;
    this.#onAccept(new URL(inbox), { ...existing, acceptedAt: now });
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
    const { inbox } =
      (await this.knownActorStore.get(new URL(existing.actor)))!;
    this.activityDispatchStore.createAndDispatch(
      new URL(inbox),
      this.apGen.directActivity(existing.persona, existing.actor, {
        type: "Reject",
        object: existing.id,
      }),
    );
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

  async deleteAllForPersona(persona: string) {
    await this.db.delete("inFollow", { persona });
  }
}
