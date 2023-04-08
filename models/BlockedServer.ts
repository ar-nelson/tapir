import { InjectableAbstract, Singleton } from "$/lib/inject.ts";
import { KnownServerStore } from "$/models/KnownServer.ts";
import { LocalDatabaseService } from "$/services/LocalDatabaseService.ts";
import {
  BlockedServerStoreReadOnly,
  BlockedServerStoreReadOnlyImpl,
  BlockOptions,
} from "./BlockedServerStoreReadOnly.ts";
export * from "./BlockedServerStoreReadOnly.ts";

@InjectableAbstract()
export abstract class BlockedServerStore {
  constructor(private readonly base: BlockedServerStoreReadOnly) {}

  list() {
    return this.base.list();
  }

  get(domain: string) {
    return this.base.get(domain);
  }

  blocksActivityUrl(url: URL) {
    return this.base.blocksActivityUrl(url);
  }

  blocksMediaUrl(url: URL) {
    return this.base.blocksMediaUrl(url);
  }

  hidesUrl(url: URL) {
    return this.base.hidesUrl(url);
  }

  count() {
    return this.base.count();
  }

  abstract create(
    domain: string,
    options?: Partial<BlockOptions>,
  ): Promise<void>;

  abstract update(
    domain: string,
    options: Partial<BlockOptions>,
  ): Promise<void>;

  abstract delete(domain: string): Promise<void>;
}

@Singleton(BlockedServerStore)
export class BlockedServerStoreImpl extends BlockedServerStore {
  constructor(
    private readonly db: LocalDatabaseService,
    private readonly knownServerStore: KnownServerStore,
    base: BlockedServerStoreReadOnlyImpl,
  ) {
    super(base);
  }

  async create(
    domain: string,
    options: Partial<BlockOptions> = {},
  ): Promise<void> {
    await this.db.insert("blockedServer", [{
      domain: domain.toLowerCase(),
      createdAt: new Date(),
      ...options,
    }]);
    if ((await this.get(domain))?.blockActivity) {
      await this.knownServerStore.deleteDomain(domain.toLowerCase());
    }
  }

  async update(domain: string, options: Partial<BlockOptions>): Promise<void> {
    await this.db.update(
      "blockedServer",
      { domain: domain.toLowerCase() },
      options,
    );
    if ((await this.get(domain))?.blockActivity) {
      await this.knownServerStore.deleteDomain(domain.toLowerCase());
    }
  }

  async delete(domain: string): Promise<void> {
    await this.db.delete("blockedServer", { domain: domain.toLowerCase() });
  }
}
