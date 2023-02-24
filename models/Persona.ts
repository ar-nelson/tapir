import { InjectableAbstract, Singleton } from "$/lib/inject.ts";
import { checkPersonaName } from "$/lib/utils.ts";
import { DatabaseService } from "$/services/DatabaseService.ts";
import { LocalDatabaseSpec } from "$/schemas/tapir/LocalDatabase.ts";
import { LocalPostStore } from "$/models/LocalPost.ts";
import { ServerConfigStore } from "$/models/ServerConfig.ts";
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

  abstract create(
    persona: Omit<Persona, "createdAt" | "updatedAt">,
  ): Promise<void>;

  abstract update(
    name: string,
    update: Partial<Omit<Persona, "name" | "createdAt" | "updatedAt">>,
  ): Promise<void>;

  abstract delete(name: string): Promise<void>;
}

@Singleton(PersonaStore)
export class PersonaStoreImpl extends PersonaStore {
  private readonly init;

  constructor(
    base: PersonaStoreReadOnlyImpl,
    private readonly db: DatabaseService<typeof LocalDatabaseSpec>,
    serverConfigStore: ServerConfigStore,
    private readonly localPostStore: LocalPostStore,
  ) {
    super(base);
    const initFn = async () => {
      for await (
        const _main of this.db.get("persona", { where: { main: true } })
      ) {
        return;
      }
      const config = await serverConfigStore.getServerConfig(),
        now = new Date();
      await this.db.insert("persona", [{
        name: config.loginName,
        displayName: config.loginName,
        summary: "tapir was here",
        requestToFollow: true,
        main: true,
        createdAt: now,
        updatedAt: now,
      }]);
    };
    this.init = initFn();
  }

  async *list() {
    await this.init;
    yield* super.list();
  }

  async count() {
    await this.init;
    return super.count();
  }

  async getMain() {
    await this.init;
    return super.getMain();
  }

  async get(name: string) {
    await this.init;
    return super.get(name);
  }

  async create(
    persona: Omit<Persona, "createdAt" | "updatedAt">,
  ): Promise<void> {
    await this.init;
    for await (
      const existing of this.db.get("persona", {
        where: { name: persona.name },
      })
    ) {
      throw new Error(
        `A persona named ${JSON.stringify(existing.name)} already exists`,
      );
    }
    checkPersonaName(persona.name);
    const now = new Date();
    await this.db.insert("persona", [{
      ...persona,
      main: false,
      createdAt: now,
      updatedAt: now,
    }]);
  }

  async update(
    name: string,
    update: Partial<Omit<Persona, "name" | "createdAt" | "updatedAt">>,
  ): Promise<void> {
    await this.init;
    const existing = await this.get(name);
    if (existing == null) {
      throw new Error(
        `Cannot update persona ${JSON.stringify(name)}: persona does not exist`,
      );
    }
    if (
      "name" in update || "main" in update || "createdAt" in update ||
      "updatedAt" in update
    ) {
      throw new TypeError("illegal fields in persona update");
    }
    await this.db.update("persona", { name }, {
      ...update,
      updatedAt: new Date(),
    });
  }

  async delete(name: string): Promise<void> {
    await this.init;
    for await (
      const { id } of this.localPostStore.list({ persona: name })
    ) {
      await this.localPostStore.delete(id);
    }
    await this.db.delete("persona", { name });
  }
}
