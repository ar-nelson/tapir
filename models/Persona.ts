import { InjectableAbstract, Singleton } from "$/lib/inject.ts";
import { generateKeyPair } from "$/lib/signatures.ts";
import * as urls from "$/lib/urls.ts";
import { checkPersonaName } from "$/lib/utils.ts";
import { ActivityDispatchStore } from "$/models/ActivityDispatch.ts";
import { InFollowStore } from "$/models/InFollow.ts";
import { LocalPostStore } from "$/models/LocalPost.ts";
import { TapirConfig } from "$/models/TapirConfig.ts";
import { ActivityPubGeneratorService } from "$/services/ActivityPubGeneratorService.ts";
import { LocalDatabaseService } from "$/services/LocalDatabaseService.ts";
import {
  Persona,
  PersonaStoreReadOnly,
  PersonaStoreReadOnlyImpl,
} from "./PersonaStoreReadOnly.ts";
export * from "./PersonaStoreReadOnly.ts";

@InjectableAbstract()
export abstract class PersonaStore extends PersonaStoreReadOnly {
  constructor(private readonly base: PersonaStoreReadOnly) {
    super();
  }

  list() {
    return this.base.list();
  }

  count() {
    return this.base.count();
  }

  getMain() {
    return this.base.getMain();
  }

  get(name: string) {
    return this.base.get(name);
  }

  publicKey(name: string) {
    return this.base.publicKey(name);
  }

  privateKey(name: string) {
    return this.base.privateKey(name);
  }

  abstract create(
    persona: Omit<
      Persona,
      "publicKey" | "privateKey" | "createdAt" | "updatedAt" | "main"
    >,
  ): Promise<void>;

  abstract update(
    name: string,
    update: Partial<
      Omit<
        Persona,
        "publicKey" | "privateKey" | "name" | "createdAt" | "updatedAt"
      >
    >,
  ): Promise<void>;

  abstract delete(name: string): Promise<void>;
}

@Singleton(PersonaStore)
export class PersonaStoreImpl extends PersonaStore {
  constructor(
    base: PersonaStoreReadOnlyImpl,
    private readonly db: LocalDatabaseService,
    private readonly apGen: ActivityPubGeneratorService,
    private readonly config: TapirConfig,
    private readonly localPostStore: LocalPostStore,
    private readonly inFollowStore: InFollowStore,
    private readonly activityDispatchStore: ActivityDispatchStore,
  ) {
    super(base);
  }

  async *list() {
    yield* super.list();
  }

  async create(
    persona: Omit<
      Persona,
      "publicKey" | "privateKey" | "createdAt" | "updatedAt" | "main"
    >,
  ): Promise<void> {
    checkPersonaName(persona.name);
    await this.db.transaction(async (db) => {
      for await (
        const { name } of db.get("persona", {
          where: { name: persona.name },
          returning: ["name"],
        })
      ) {
        throw new Error(
          `A persona named ${JSON.stringify(name)} already exists`,
        );
      }
      let main = true;
      for await (
        const _ of db.get("persona", {
          where: { main: true },
          limit: 1,
          returning: ["name"],
        })
      ) {
        main = false;
      }
      const keyPair = await generateKeyPair(), now = new Date();
      await db.insert("persona", [{
        ...persona,
        main,
        publicKey: new Uint8Array(
          await crypto.subtle.exportKey("spki", keyPair.publicKey),
        ),
        privateKey: new Uint8Array(
          await crypto.subtle.exportKey("pkcs8", keyPair.privateKey),
        ),
        createdAt: now,
        updatedAt: now,
      }]);
    });
  }

  async update(
    name: string,
    update: Partial<
      Omit<
        Persona,
        "publicKey" | "privateKey" | "name" | "createdAt" | "updatedAt"
      >
    >,
  ): Promise<void> {
    const existing = await this.get(name);
    if (existing == null) {
      throw new Error(
        `Cannot update persona ${JSON.stringify(name)}: persona does not exist`,
      );
    }
    if (
      "name" in update || "main" in update || "createdAt" in update ||
      "updatedAt" in update || "publicKey" in update || "privateKey" in update
    ) {
      throw new TypeError("illegal fields in persona update");
    }
    const updatedAt = new Date();
    await this.db.update("persona", { name }, { ...update, updatedAt });
    await this.activityDispatchStore.createAndDispatch(
      await this.inFollowStore.listFollowerInboxes(name),
      this.apGen.publicActivity(
        name,
        {
          type: "Update",
          object: await this.apGen.actor(
            { ...existing, ...update, updatedAt },
            await this.publicKey(name),
          ),
        },
      ),
    );
  }

  async delete(name: string): Promise<void> {
    const persona = await this.get(name);
    if (!persona) {
      throw new Error(
        `Cannot delete persona ${JSON.stringify(name)}: persona does not exist`,
      );
    }
    if (persona.main) {
      throw new Error(
        `Cannot delete persona ${
          JSON.stringify(name)
        }: cannot delete main persona`,
      );
    }
    for await (
      const { id } of this.localPostStore.list({ persona: name })
    ) {
      await this.localPostStore.delete(id);
    }
    const inboxes = await this.inFollowStore.listFollowerInboxes(name);
    await this.inFollowStore.deleteAllForPersona(name);
    await this.db.delete("persona", { name });
    await this.activityDispatchStore.createAndDispatch(
      inboxes,
      this.apGen.publicActivity(
        name,
        {
          type: "Delete",
          object: {
            id: urls.activityPubActor(name, this.config.url),
            type: "Person",
          },
        },
      ),
    );
  }
}
