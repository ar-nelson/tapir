// in a separate file to break a dependency cycle
import { InjectableAbstract, Singleton } from "$/lib/inject.ts";
import { DatabaseService } from "$/services/DatabaseService.ts";
import { Q, QueryOperator } from "$/lib/sql/mod.ts";
import { LocalDatabaseSpec } from "$/schemas/tapir/LocalDatabase.ts";

export interface BlockOptions {
  readonly blockActivity: boolean;
  readonly blockMedia: boolean;
  readonly hideInFeeds: boolean;
}

export interface BlockedServer extends BlockOptions {
  readonly domain: string;
  readonly createdAt: Date;
}

@InjectableAbstract()
export abstract class BlockedServerStoreReadOnly {
  abstract list(): AsyncIterable<BlockedServer>;

  abstract get(domain: string): Promise<BlockedServer | null>;

  abstract blocksActivityUrl(url: URL): Promise<boolean>;

  abstract blocksMediaUrl(url: URL): Promise<boolean>;

  abstract hidesUrl(url: URL): Promise<boolean>;

  abstract count(): Promise<number>;
}

@Singleton(BlockedServerStoreReadOnly)
export class BlockedServerStoreReadOnlyImpl extends BlockedServerStoreReadOnly {
  constructor(private readonly db: DatabaseService<typeof LocalDatabaseSpec>) {
    super();
  }

  list(): AsyncIterable<BlockedServer> {
    return this.db.get("blockedServer", {});
  }

  count(): Promise<number> {
    return this.db.count("blockedServer", {});
  }

  async get(domain: string): Promise<BlockedServer | null> {
    for await (
      const r of this.db.get("blockedServer", {
        where: { domain: domain.toLowerCase() },
        limit: 1,
      })
    ) {
      return r;
    }
    return null;
  }

  async blocksActivityUrl({ hostname }: URL): Promise<boolean> {
    const suffix = hostname.includes(".")
      ? hostname.slice(hostname.lastIndexOf("."))
      : hostname;
    for await (
      const r of this.db.get("blockedServer", {
        where: {
          domain: new Q(QueryOperator.Ilike, `%${suffix}`),
          blockActivity: true,
        },
      })
    ) {
      if (hostname.endsWith(r.domain)) {
        return true;
      }
    }
    return false;
  }

  async blocksMediaUrl({ hostname }: URL): Promise<boolean> {
    const suffix = hostname.includes(".")
      ? hostname.slice(hostname.lastIndexOf("."))
      : hostname;
    for await (
      const r of this.db.get("blockedServer", {
        where: {
          domain: new Q(QueryOperator.Ilike, `%${suffix}`),
          blockMedia: true,
        },
      })
    ) {
      if (hostname.endsWith(r.domain)) {
        return true;
      }
    }
    return false;
  }

  async hidesUrl({ hostname }: URL): Promise<boolean> {
    const suffix = hostname.includes(".")
      ? hostname.slice(hostname.lastIndexOf("."))
      : hostname;
    for await (
      const r of this.db.get("blockedServer", {
        where: {
          domain: new Q(QueryOperator.Ilike, `%${suffix}`),
          hideInFeeds: true,
        },
      })
    ) {
      if (hostname.endsWith(r.domain)) {
        return true;
      }
    }
    return false;
  }
}
