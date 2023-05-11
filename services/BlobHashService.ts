import { CrockfordBase32 } from "$/lib/base32.ts";
import { InjectableAbstract, Singleton } from "$/lib/inject.ts";
import { InstanceConfigStore } from "$/models/InstanceConfig.ts";

@InjectableAbstract()
export abstract class BlobHashService {
  abstract isHash(maybeHash: string): boolean;
  abstract hash(data: Uint8Array): Promise<string>;
}

@Singleton(BlobHashService)
export class Sha256BlobHashService extends BlobHashService {
  readonly #salt;

  constructor(instanceConfigStore: InstanceConfigStore) {
    super();
    this.#salt = instanceConfigStore.get().then((s) => s.mediaSalt);
  }

  isHash(maybeHash: string): boolean {
    return /^[A-Z0-9]{52}$/i.test(maybeHash);
  }

  async hash(data: Uint8Array): Promise<string> {
    const salted = new Blob([await this.#salt, data], { type: "text/plain" }),
      hash = await crypto.subtle.digest("SHA-256", await salted.arrayBuffer());
    return CrockfordBase32.encode(new Uint8Array(hash));
  }
}
