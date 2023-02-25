// in a separate file to break a dependency cycle
import { InjectableAbstract, Singleton } from "$/lib/inject.ts";
import { DatabaseService } from "$/services/DatabaseService.ts";
import { LocalDatabaseSpec } from "$/schemas/tapir/LocalDatabase.ts";

export interface Persona {
  readonly name: string;
  readonly displayName: string;
  readonly summary: string;
  readonly requestToFollow: boolean;
  readonly createdAt: string;
  readonly updatedAt?: string;
}

@InjectableAbstract()
export abstract class PersonaStoreReadOnly {
  abstract list(): AsyncIterable<Persona>;

  abstract count(): Promise<number>;

  abstract getMain(): Promise<Persona>;

  abstract get(name: string): Promise<Persona | null>;
}

@Singleton(PersonaStoreReadOnly)
export class PersonaStoreReadOnlyImpl extends PersonaStoreReadOnly {
  constructor(
    private readonly db: DatabaseService<typeof LocalDatabaseSpec>,
  ) {
    super();
  }

  async *list(): AsyncIterable<Persona> {
    for await (
      const p of this.db.get("persona", { orderBy: [["createdAt", "ASC"]] })
    ) {
      yield {
        ...p,
        createdAt: p.createdAt.toJSON(),
        updatedAt: p.updatedAt?.toJSON(),
      };
    }
  }

  count(): Promise<number> {
    return this.db.count("persona", {});
  }

  async getMain(): Promise<Persona> {
    for await (
      const p of this.db.get("persona", { where: { main: true } })
    ) {
      return {
        ...p,
        createdAt: p.createdAt.toJSON(),
        updatedAt: p.updatedAt?.toJSON(),
      };
    }
    throw new Error(
      "Database is in an illegal state: a main persona must exist",
    );
  }

  async get(name: string): Promise<Persona | null> {
    for await (
      const p of this.db.get("persona", { where: { name } })
    ) {
      return {
        ...p,
        createdAt: p.createdAt.toJSON(),
        updatedAt: p.updatedAt?.toJSON(),
      };
    }
    return null;
  }
}
