import { LogLevels, Tag } from "$/lib/error.ts";
import { InjectableAbstract, Singleton } from "$/lib/inject.ts";
import { generateKeyPair } from "$/lib/signatures.ts";
import { Q } from "$/lib/sql/mod.ts";
import * as urls from "$/lib/urls.ts";
import { KeyAlgorithm } from "$/models/types.ts";
import { LocalDatabaseService } from "$/services/LocalDatabaseService.ts";

export interface Key {
  readonly name: string;
  readonly algorithm: KeyAlgorithm;
  readonly private: Uint8Array;
  readonly public?: Uint8Array | null;
}

export const KeyNotFound = new Tag("Encryption Key Not Found");
export const KeyStorageFailure = new Tag("Encryption Key Storage Failure", {
  level: LogLevels.CRITICAL,
});
export const CreateKeyFailed = new Tag("Create Encryption Key Failed");
export const DeleteKeyFailed = new Tag("Delete Encryption Key Failed");

export function personaRsaKeyName(personaName: string, baseUrl: string) {
  return urls.activityPubActor(personaName, baseUrl) + "#main-key";
}

@InjectableAbstract()
export abstract class KeyStore {
  abstract get(name: string): Promise<Key>;
  abstract getRSA_SHA256(name: string): Promise<CryptoKeyPair>;
  // TODO: Ed25519
  // TODO: Secp256k1
  // TODO: TLS certificates
  abstract list(): AsyncIterable<Key>;
  abstract insert(key: Key): Promise<void>;
  abstract generate(name: string, algorithm: KeyAlgorithm): Promise<Key>;
  abstract delete(name: string): Promise<void>;
}

@Singleton(KeyStore)
export class KeyStoreImpl extends KeyStore {
  #rsaSha256Cache = new Map<string, CryptoKeyPair>();

  constructor(private readonly db: LocalDatabaseService) {
    super();
  }

  async get(name: string): Promise<Key> {
    for await (const key of this.db.get("key", { where: { name }, limit: 1 })) {
      return key;
    }
    throw KeyNotFound.error(`No key with name ${JSON.stringify(name)}`);
  }

  async getRSA_SHA256(name: string): Promise<CryptoKeyPair> {
    const existing = this.#rsaSha256Cache.get(name);
    if (existing) return existing;
    for await (
      const key of this.db.get("key", {
        where: {
          name,
          algorithm: KeyAlgorithm.RSA_SHA256,
          public: Q.notNull(),
        },
        limit: 1,
        returning: ["public", "private"],
      })
    ) {
      try {
        const keyPair = {
          privateKey: await crypto.subtle.importKey(
            "pkcs8",
            key.private,
            {
              name: "RSASSA-PKCS1-v1_5",
              hash: { name: "SHA-256" },
            },
            true,
            ["sign"],
          ),
          publicKey: await crypto.subtle.importKey(
            "spki",
            key.public!,
            {
              name: "RSASSA-PKCS1-v1_5",
              hash: { name: "SHA-256" },
            },
            true,
            ["verify"],
          ),
        };
        this.#rsaSha256Cache.set(name, keyPair);
        return keyPair;
      } catch (e) {
        throw KeyStorageFailure.error(
          `Failed to decode RSA-SHA256 key ${JSON.stringify(name)}`,
          e,
        );
      }
    }
    throw KeyNotFound.error(
      `No RSA-SHA256 key with name ${JSON.stringify(name)}`,
    );
  }

  list(): AsyncIterable<Key> {
    return this.db.get("key");
  }

  async insert(key: Key): Promise<void> {
    try {
      await this.db.insert("key", [key]);
      this.#rsaSha256Cache.delete(key.name);
    } catch (e) {
      throw CreateKeyFailed.wrap(e);
    }
  }

  async generate(name: string, algorithm: KeyAlgorithm): Promise<Key> {
    try {
      switch (algorithm) {
        case KeyAlgorithm.RSA_SHA256: {
          const keyPair = await generateKeyPair(),
            key = {
              name,
              algorithm,
              private: new Uint8Array(
                await crypto.subtle.exportKey("pkcs8", keyPair.privateKey),
              ),
              public: new Uint8Array(
                await crypto.subtle.exportKey("spki", keyPair.publicKey),
              ),
            };
          await this.insert(key);
          return key;
        }
        case KeyAlgorithm.Ed25519:
          throw CreateKeyFailed.error("Ed25519 is not yet implemented");
        case KeyAlgorithm.Secp256k1:
          throw CreateKeyFailed.error("Secp256k1 is not yet implemented");
        case KeyAlgorithm.TLSCert:
          throw CreateKeyFailed.error(
            "Custom TLS certificates are not yet implemented",
          );
      }
    } catch (e) {
      throw CreateKeyFailed.wrap(e);
    }
  }

  async delete(name: string): Promise<void> {
    try {
      await this.db.delete("key", { name });
      this.#rsaSha256Cache.delete(name);
    } catch (e) {
      throw DeleteKeyFailed.wrap(e);
    }
  }
}
