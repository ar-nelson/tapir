import { log } from "$/deps.ts";
import { DateDiff, datetime } from "$/lib/datetime/mod.ts";
import { InjectableAbstract, Singleton } from "$/lib/inject.ts";
import { publicKeyFromPem } from "$/lib/signatures.ts";
import { KnownServerStore } from "$/models/KnownServer.ts";
import { Actor, assertIsActor } from "$/schemas/activitypub/mod.ts";
import {
  ActivityPubClientService,
  Priority,
} from "$/services/ActivityPubClientService.ts";
import { ActivityPubGeneratorService } from "$/services/ActivityPubGeneratorService.ts";
import { LocalDatabaseService } from "$/services/LocalDatabaseService.ts";

export interface KnownActor {
  readonly url: string;
  readonly name: string;
  readonly displayName?: string | null;
  readonly profileUrl: string;
  readonly smallAvatar?: Uint8Array | null;
  readonly publicKey?: Uint8Array | null;
  readonly publicKeyId?: string | null;
  readonly publicKeyType?: string | null;
  readonly server: string;
  readonly inbox: string;
  readonly outbox: string;
  readonly lastSeen?: Date | null;
  readonly updatedAt: Date;
}

@InjectableAbstract()
export abstract class KnownActorStore {
  abstract get(url: URL): Promise<KnownActor | null>;

  abstract fetch(
    url: URL,
    asPersona: string,
    updateFrequency?: DateDiff,
  ): Promise<KnownActor | null>;

  abstract count(where?: { server?: string }): Promise<number>;

  abstract list(where?: { server?: string }): AsyncIterable<KnownActor>;

  abstract create(
    actor: Omit<KnownActor, "lastSeen" | "updatedAt">,
  ): Promise<KnownActor>;

  abstract update(
    url: URL,
    patch: Omit<KnownActor, "url" | "updatedAt">,
  ): Promise<void>;

  abstract delete(url: string): Promise<void>;
}

@Singleton(KnownActorStore)
export class KnownActorStoreImpl extends KnownActorStore {
  constructor(
    private readonly db: LocalDatabaseService,
    private readonly knownServerStore: KnownServerStore,
    private readonly apClient: ActivityPubClientService,
    private readonly apGen: ActivityPubGeneratorService,
  ) {
    super();
  }

  async get(url: URL) {
    for await (
      const row of this.db.get("knownActor", { where: { url: url.toString() } })
    ) {
      return row;
    }
    return null;
  }

  async fetch(url: URL, asPersona: string, updateFrequency = { weeks: 1 }) {
    const existing = await this.get(url);
    if (
      !existing?.lastSeen ||
      datetime(existing.lastSeen).isBefore(datetime().subtract(updateFrequency))
    ) {
      let newActor: Actor | null = null;
      try {
        newActor = await this.apClient.getObject<Actor>(
          url,
          asPersona,
          Priority.Soon,
          assertIsActor as any, // I think I broke typescript, whoops
        );
      } catch (e) {
        log.error(
          `Failed to ${
            existing ? "re-fetch existing" : "fetch new"
          } actor ${url}`,
        );
        log.error(e);
      }
      if (newActor) {
        this.knownServerStore.seen(url, newActor.endpoints?.sharedInbox);
        const fields = {
          name: newActor.name,
          displayName: newActor.preferredUsername,
          profileUrl: this.apClient.getOneLink(newActor.url) ?? url.toString(),
          inbox: newActor.inbox,
          outbox: newActor.outbox,
          server: `${url.protocol}//${url.host}`,
          ...await this.#getPublicKey(newActor),
        };
        if (existing) {
          const updatedAt = new Date();
          await this.db.update("knownActor", { url: url.toString() }, {
            ...fields,
            updatedAt,
          });
          return { ...existing, ...fields, updatedAt };
        } else {
          return this.create({ url: url.toString(), ...fields });
        }
      }
    }
    return existing;
  }

  async #getPublicKey(
    actor: Actor,
  ): Promise<
    {
      publicKey: Uint8Array | null;
      publicKeyId: string | null;
      publicKeyType: string | null;
    }
  > {
    if (
      !actor.publicKey || !actor.publicKey.publicKeyPem || !actor.publicKey.id
    ) {
      log.warning(`Actor ${actor.id} does not have a public key`);
    } else {
      try {
        const key: CryptoKey = await publicKeyFromPem(
          actor.publicKey.publicKeyPem,
        );
        return {
          publicKey: new Uint8Array(await crypto.subtle.exportKey("spki", key)),
          publicKeyId: actor.publicKey.id,
          publicKeyType: `${key.algorithm}`,
        };
      } catch (e) {
        log.warning(`Failed to parse public key of actor ${actor.id}`);
        log.warning(e);
      }
    }
    return { publicKey: null, publicKeyId: null, publicKeyType: null };
  }

  count(where: { server?: string } = {}) {
    return this.db.count("knownActor", where);
  }

  list(where?: { server?: string }) {
    return this.db.get("knownActor", { where });
  }

  async create(
    actor: Omit<KnownActor, "lastSeen" | "updatedAt">,
  ): Promise<KnownActor> {
    const now = new Date(),
      knownActor = {
        ...actor,
        lastSeen: now,
        updatedAt: now,
      };
    await this.db.insert("knownActor", [knownActor]);
    return knownActor;
  }

  async update(
    url: URL,
    patch: Omit<KnownActor, "url" | "updatedAt">,
  ): Promise<void> {
    await this.db.update("knownActor", { url: url.toString() }, {
      ...patch,
      updatedAt: new Date(),
    });
  }

  async delete(url: string): Promise<void> {
    await this.db.delete("knownActor", { url });
  }
}
