import { Status } from "$/deps.ts";
import { LogLevels, Tag } from "$/lib/error.ts";
import { InjectableAbstract, Singleton } from "$/lib/inject.ts";
import { ColumnsOf, OutRow } from "$/lib/sql/mod.ts";
import * as urls from "$/lib/urls.ts";
import { checkPersonaName, mapAsyncIterable } from "$/lib/utils.ts";
import { KeyStore } from "$/models/Key.ts";
import { LocalPostStore } from "$/models/LocalPost.ts";
import { KeyAlgorithm, Persona, ProfileType } from "$/models/types.ts";
import { LocalDatabaseTables } from "$/schemas/tapir/db/local/mod.ts";
import { LocalDatabaseService } from "$/services/LocalDatabaseService.ts";
import { PublisherService } from "$/services/PublisherService.ts";

export const NoMainPersona = new Tag("No Main Persona", {
  level: LogLevels.CRITICAL,
});
export const PersonaNotFound = new Tag("Persona Not Found", {
  level: LogLevels.WARNING,
  internal: false,
  httpStatus: Status.NotFound,
});
export const CreatePersonaFailed = new Tag("Create Persona Failed");
export const UpdatePersonaFailed = new Tag("Update Persona Failed");
export const DeletePersonaFailed = new Tag("Delete Persona Failed");

@InjectableAbstract()
export abstract class PersonaStore {
  abstract list(): AsyncIterable<Persona>;

  abstract count(): Promise<number>;

  abstract getMain(): Promise<Persona>;

  abstract get(name: string): Promise<Persona>;

  abstract create(
    persona: Omit<
      Persona,
      "createdAt" | "updatedAt" | "main"
    >,
  ): Promise<void>;

  abstract update(
    name: string,
    update: Partial<
      Omit<
        Persona,
        "name" | "createdAt" | "updatedAt" | "main"
      >
    >,
  ): Promise<void>;

  abstract delete(name: string): Promise<void>;
}

@Singleton(PersonaStore)
export class PersonaStoreImpl extends PersonaStore {
  constructor(
    private readonly db: LocalDatabaseService,
    private readonly publisherService: PublisherService,
    private readonly localPostStore: LocalPostStore,
    private readonly keyStore: KeyStore,
  ) {
    super();
  }

  #rowToObject(
    row: OutRow<ColumnsOf<LocalDatabaseTables, "persona">>,
  ): Persona {
    return {
      ...row,
      type: row.type as ProfileType,
    };
  }

  list(): AsyncIterable<Persona> {
    return mapAsyncIterable(
      this.db.get("persona", { orderBy: [["createdAt", "ASC"]] }),
      this.#rowToObject,
    );
  }

  count(): Promise<number> {
    return this.db.count("persona", {});
  }

  async getMain(): Promise<Persona> {
    for await (
      const p of this.db.get("persona", { where: { main: true }, limit: 1 })
    ) {
      return this.#rowToObject(p);
    }
    throw NoMainPersona.error(
      "Database is in an illegal state: a main persona must exist",
    );
  }

  async get(name: string): Promise<Persona> {
    for await (
      const p of this.db.get("persona", { where: { name }, limit: 1 })
    ) {
      return this.#rowToObject(p);
    }
    throw PersonaNotFound.error(`No persona named ${JSON.stringify(name)}`);
  }

  async create(
    persona: Omit<
      Persona,
      "createdAt" | "updatedAt" | "main"
    >,
  ): Promise<void> {
    try {
      checkPersonaName(persona.name);
      await this.db.transaction(async (db) => {
        for await (
          const { name } of db.get("persona", {
            where: { name: persona.name },
            returning: ["name"],
          })
        ) {
          throw CreatePersonaFailed.error(
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
        await this.keyStore.generate(
          urls.activityPubMainKey(persona.name),
          KeyAlgorithm.RSA_SHA256,
        );
        const now = new Date();
        await db.insert("persona", [{
          ...persona,
          main,
          createdAt: now,
          updatedAt: now,
        }]);
      });
    } catch (e) {
      throw CreatePersonaFailed.wrap(e);
    }
  }

  async update(
    name: string,
    update: Partial<
      Omit<
        Persona,
        "name" | "createdAt" | "updatedAt" | "main"
      >
    >,
  ): Promise<void> {
    try {
      const existing = await this.get(name);
      if (existing == null) {
        throw PersonaNotFound.error(
          `Persona ${JSON.stringify(name)} does not exist`,
        );
      }
      if (
        "name" in update || "main" in update || "createdAt" in update ||
        "updatedAt" in update
      ) {
        throw UpdatePersonaFailed.error("illegal fields in persona update");
      }
      const updatedAt = new Date();
      await this.publisherService.updatePersona({
        ...existing,
        ...update,
        updatedAt,
      });
      await this.db.update("persona", { name }, { ...update, updatedAt });
    } catch (e) {
      throw UpdatePersonaFailed.wrap(e);
    }
  }

  async delete(name: string): Promise<void> {
    try {
      const persona = await this.get(name);
      if (!persona) {
        throw PersonaNotFound.error(
          `Persona ${JSON.stringify(name)} does not exist`,
        );
      }
      if (persona.main) {
        throw DeletePersonaFailed.error(
          `Cannot delete main persona ${JSON.stringify(name)}`,
        );
      }
      for await (
        const { id } of this.localPostStore.list({ persona: name })
      ) {
        await this.localPostStore.delete(id);
      }
      await this.publisherService.deletePersona(name);
      await this.db.delete("persona", { name });
    } catch (e) {
      throw DeletePersonaFailed.wrap(e);
    }
  }
}
