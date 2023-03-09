// in a separate file to break a dependency cycle
import { InjectableAbstract, Singleton } from "$/lib/inject.ts";
import { LocalDatabaseService } from "$/services/LocalDatabaseService.ts";

export interface Persona {
  readonly name: string;
  readonly displayName: string;
  readonly linkTitle?: string;
  readonly summary: string;
  readonly requestToFollow: boolean;
  readonly createdAt: Date;
  readonly updatedAt?: Date;
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
  constructor(private readonly db: LocalDatabaseService) {
    super();
  }

  list(): AsyncIterable<Persona> {
    return this.db.get("persona", { orderBy: [["createdAt", "ASC"]] });
  }

  count(): Promise<number> {
    return this.db.count("persona", {});
  }

  async getMain(): Promise<Persona> {
    for await (
      const p of this.db.get("persona", { where: { main: true } })
    ) {
      return p;
    }
    throw new Error(
      "Database is in an illegal state: a main persona must exist",
    );
  }

  async get(name: string): Promise<Persona | null> {
    for await (
      const p of this.db.get("persona", { where: { name } })
    ) {
      return p;
    }
    return null;
  }
}
