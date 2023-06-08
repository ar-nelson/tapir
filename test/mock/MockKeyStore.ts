import { Singleton } from "$/lib/inject.ts";
import { generateKeyPair } from "$/lib/signatures.ts";
import * as urls from "$/lib/urls.ts";
import { Key, KeyNotFound, KeyStore } from "$/models/Key.ts";
import { KeyAlgorithm } from "$/models/types.ts";

const KEY_NAME = urls.activityPubMainKey("tapir");

@Singleton()
export class MockKeyStore extends KeyStore {
  #keyPair = generateKeyPair();

  constructor() {
    super();
  }

  async get(name: string): Promise<Key> {
    if (name === KEY_NAME) {
      const keyPair = await this.#keyPair;
      return {
        name,
        algorithm: KeyAlgorithm.RSA_SHA256,
        private: new Uint8Array(
          await crypto.subtle.exportKey("pkcs8", keyPair.privateKey),
        ),
        public: new Uint8Array(
          await crypto.subtle.exportKey("spki", keyPair.publicKey),
        ),
      };
    }
    throw KeyNotFound.error(`No key with name ${JSON.stringify(name)}`);
  }

  getRSA_SHA256(name: string): Promise<CryptoKeyPair> {
    if (name === KEY_NAME) {
      return this.#keyPair;
    }
    throw KeyNotFound.error(`No key with name ${JSON.stringify(name)}`);
  }

  async *list(): AsyncIterable<Key> {
    yield await this.get(KEY_NAME);
  }

  insert(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  generate(): Promise<Key> {
    throw new Error("Method not implemented.");
  }

  delete(): Promise<void> {
    throw new Error("Method not implemented.");
  }
}
