import { InjectableAbstract, Singleton } from "$/lib/inject.ts";
import { DatabaseService, Order, QueryOp } from "$/services/DatabaseService.ts";
import { LocalDatabaseSpec } from "$/schemas/tapir/LocalDatabase.ts";
import { LocalPostStore } from "$/models/LocalPost.ts";

export interface Persona {
  readonly name: string;
  readonly displayName: string;
  readonly summary: string;
  readonly requestToFollow: boolean;
  readonly createdAt: string;
  readonly updatedAt?: string;
}

@InjectableAbstract()
export abstract class PersonaStore {
  abstract list(): AsyncIterable<Persona>;

  abstract count(): Promise<number>;

  abstract getMain(): Promise<Persona>;

  abstract get(name: string): Promise<Persona | null>;

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
  private readonly table;

  constructor(
    db: DatabaseService<typeof LocalDatabaseSpec>,
    private readonly localPostStore: LocalPostStore,
  ) {
    super();
    this.table = db.table("persona");
  }

  async *list(): AsyncIterable<Persona> {
    for await (
      const p of this.table.get({ orderBy: [["createdAt", Order.Ascending]] })
    ) {
      yield {
        ...p,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt?.toISOString(),
      };
    }
  }

  count(): Promise<number> {
    return this.table.count({});
  }

  async getMain(): Promise<Persona> {
    for await (
      const p of this.table.get({ where: { main: [QueryOp.Eq, true] } })
    ) {
      return {
        ...p,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt?.toISOString(),
      };
    }
    throw new Error(
      "Database is in an illegal state: a main persona must exist",
    );
  }

  async get(name: string): Promise<Persona | null> {
    for await (
      const p of this.table.get({ where: { name: [QueryOp.Eq, name] } })
    ) {
      return {
        ...p,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt?.toISOString(),
      };
    }
    return null;
  }

  async create(
    persona: Omit<Persona, "createdAt" | "updatedAt">,
  ): Promise<void> {
    for await (
      const existing of this.table.get({
        where: { name: [QueryOp.Eq, persona.name] },
      })
    ) {
      throw new Error(
        `A persona named ${JSON.stringify(existing.name)} already exists`,
      );
    }
    const now = new Date();
    await this.table.insert([{
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
    await this.table.update({ name: [QueryOp.Eq, name] }, {
      ...update,
      updatedAt: new Date(),
    });
  }

  async delete(name: string): Promise<void> {
    for await (
      const { id } of this.localPostStore.list({ persona: name })
    ) {
      await this.localPostStore.delete(id);
    }
    await this.table.delete({ name: [QueryOp.Eq, name] });
  }
}

const MOCK_PERSONA: Persona = {
  name: "tapir",
  displayName: "tapir",
  summary: "look at me. i'm the fediverse now.",
  requestToFollow: true,
  createdAt: "2023-02-03T19:35:27-0500",
};

@Singleton(PersonaStore)
export class MockPersonaStore extends PersonaStore {
  async *list() {
    yield MOCK_PERSONA;
  }

  count() {
    return Promise.resolve(1);
  }

  getMain() {
    return Promise.resolve(MOCK_PERSONA);
  }

  get(name: string) {
    return Promise.resolve(name === "tapir" ? MOCK_PERSONA : null);
  }

  create() {
    return Promise.reject(new Error("create is not supported"));
  }

  update() {
    return Promise.reject(new Error("update is not supported"));
  }

  delete() {
    return Promise.reject(new Error("delete is not supported"));
  }
}
