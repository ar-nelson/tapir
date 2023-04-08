// in a separate file to break a dependency cycle
import { InjectableAbstract, Singleton } from "$/lib/inject.ts";
import { LocalDatabaseService } from "$/services/LocalDatabaseService.ts";

export interface Persona {
  readonly name: string;
  readonly displayName: string;
  readonly linkTitle?: string | null;
  readonly summary: string;
  readonly requestToFollow: boolean;
  readonly createdAt: Date;
  readonly updatedAt?: Date;
  readonly main: boolean;
}

@InjectableAbstract()
export abstract class PersonaStoreReadOnly {
  abstract list(): AsyncIterable<Persona>;

  abstract count(): Promise<number>;

  abstract getMain(): Promise<Persona>;

  abstract get(name: string): Promise<Persona | null>;

  abstract publicKey(name: string): Promise<CryptoKey>;

  abstract privateKey(name: string): Promise<CryptoKey>;
}

@Singleton(PersonaStoreReadOnly)
export class PersonaStoreReadOnlyImpl extends PersonaStoreReadOnly {
  #publicKeys = new Map<string, Promise<CryptoKey>>();
  #privateKeys = new Map<string, Promise<CryptoKey>>();

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
      const p of this.db.get("persona", { where: { main: true }, limit: 1 })
    ) {
      return p;
    }
    throw new Error(
      "Database is in an illegal state: a main persona must exist",
    );
  }

  async get(name: string): Promise<Persona | null> {
    for await (
      const p of this.db.get("persona", { where: { name }, limit: 1 })
    ) {
      return p;
    }
    return null;
  }

  publicKey(name: string) {
    const existing = this.#publicKeys.get(name);
    if (existing) return existing;
    const newPromise = (async () => {
      for await (
        const { publicKey } of this.db.get("persona", {
          where: { name },
          returning: ["publicKey"],
          limit: 1,
        })
      ) {
        return crypto.subtle.importKey(
          "spki",
          publicKey,
          {
            name: "RSASSA-PKCS1-v1_5",
            hash: { name: "SHA-256" },
          },
          true,
          ["verify"],
        );
      }
      throw new Error(`No persona named ${name}; cannot get public key`);
    })();
    this.#publicKeys.set(name, newPromise);
    return newPromise;
  }

  privateKey(name: string) {
    const existing = this.#privateKeys.get(name);
    if (existing) return existing;
    const newPromise = (async () => {
      for await (
        const { privateKey } of this.db.get("persona", {
          where: { name },
          returning: ["privateKey"],
          limit: 1,
        })
      ) {
        return crypto.subtle.importKey(
          "pkcs8",
          privateKey,
          {
            name: "RSASSA-PKCS1-v1_5",
            hash: { name: "SHA-256" },
          },
          true,
          ["sign"],
        );
      }
      throw new Error(`No persona named ${name}; cannot get private key`);
    })();
    this.#privateKeys.set(name, newPromise);
    return newPromise;
  }
}
