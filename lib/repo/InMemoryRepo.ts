import { Repo } from "./Repo.ts";
import { RepoFactory } from "./RepoFactory.ts";
import { Singleton } from "$/lib/inject.ts";
import { BlobHashService } from "$/services/BlobHashService.ts";

export abstract class InMemoryRepo implements Repo {
  readonly #map = new Map<string, Uint8Array>();

  constructor(private readonly hash: BlobHashService) {}

  get(hash: string): Promise<Uint8Array | null> {
    if (!this.hash.isHash(hash)) {
      throw new TypeError(
        `${JSON.stringify(hash)} is not a valid media repo hash`,
      );
    }
    return Promise.resolve(this.#map.get(hash) ?? null);
  }

  has(hash: string): Promise<boolean> {
    return Promise.resolve(this.#map.has(hash));
  }

  async put(data: Uint8Array): Promise<string> {
    const hash = await this.hash.hash(data);
    this.#map.set(hash, data);
    return hash;
  }

  delete(hash: string): Promise<void> {
    this.#map.delete(hash);
    return Promise.resolve();
  }

  clear(): Promise<void> {
    this.#map.clear();
    return Promise.resolve();
  }

  async *[Symbol.asyncIterator](): AsyncIterator<string> {
    for (const k of this.#map.keys()) {
      yield k;
    }
  }
}

export class InMemoryRepoFactory extends RepoFactory {
  protected construct() {
    @Singleton()
    class InMemoryRepoImpl extends InMemoryRepo {}

    return InMemoryRepoImpl;
  }
}
