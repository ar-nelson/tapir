import { Repo } from "./Repo.ts";
import { Constructor } from "$/lib/inject.ts";

export abstract class AbstractRepoService implements Repo {
  abstract get(hash: string): Promise<Uint8Array | null>;
  abstract has(hash: string): Promise<boolean>;
  abstract put(data: Uint8Array): Promise<string>;
  abstract delete(hash: string): Promise<void>;
  abstract clear(): Promise<void>;
  abstract [Symbol.asyncIterator](): AsyncIterator<string>;
}

export abstract class RepoFactory {
  protected abstract construct(): Constructor<Repo>;

  constructService<Service extends AbstractRepoService>(): Constructor<
    Service
  > {
    return this.construct() as Constructor<Service>;
  }
}
