import { InjectableAbstract, Singleton } from "$/lib/inject.ts";
import { DatabaseService } from "$/services/DatabaseService.ts";
import { Q } from "$/lib/sql/mod.ts";
import { LocalDatabaseSpec } from "$/schemas/tapir/LocalDatabase.ts";
import { BlockedServerStoreReadOnly } from "$/models/BlockedServerStoreReadOnly.ts";
import { log } from "$/deps.ts";

export interface KnownServer {
  readonly url: string;
  readonly sharedInbox: string | null;
  readonly firstSeen: Date;
  readonly lastSeen: Date;
}

@InjectableAbstract()
export abstract class KnownServerStoreReadOnly {
  abstract list(): AsyncIterable<KnownServer>;

  abstract get(url: URL): Promise<KnownServer | null>;

  abstract count(): Promise<number>;

  abstract sharedInboxes(): Promise<ReadonlySet<string>>;
}

@InjectableAbstract()
export abstract class KnownServerStore extends KnownServerStoreReadOnly {
  constructor(private readonly base: KnownServerStoreReadOnly) {
    super();
  }

  list() {
    return this.base.list();
  }

  get(url: URL) {
    return this.base.get(url);
  }

  count() {
    return this.base.count();
  }

  sharedInboxes() {
    return this.base.sharedInboxes();
  }

  abstract seen(url: URL, sharedInbox?: string): Promise<void>;

  abstract delete(url: URL): Promise<void>;

  abstract deleteDomain(domain: string): Promise<void>;
}

@Singleton(KnownServerStoreReadOnly)
export class KnownServerStoreReadOnlyImpl extends KnownServerStoreReadOnly {
  #sharedInboxSet: Promise<ReadonlySet<string>> | null = null;

  constructor(
    private readonly db: DatabaseService<typeof LocalDatabaseSpec>,
  ) {
    super();
  }

  list(): AsyncIterable<KnownServer> {
    return this.db.get("knownServer", {});
  }

  count(): Promise<number> {
    return this.db.count("knownServer", {});
  }

  async get({ protocol, host }: URL): Promise<KnownServer | null> {
    const url = `${protocol}//${host}`;
    for await (
      const p of this.db.get("knownServer", {
        where: { url: url.toLowerCase() },
        limit: 1,
      })
    ) {
      return p;
    }
    return null;
  }

  sharedInboxes() {
    if (this.#sharedInboxSet) return this.#sharedInboxSet;
    return this.#sharedInboxSet = (async () => {
      const inboxen = new Set<string>();
      for await (
        const { sharedInbox } of this.db.get("knownServer", {
          where: { sharedInbox: Q.notNull() },
          returning: ["sharedInbox"],
        })
      ) {
        inboxen.add(sharedInbox!);
      }
      return inboxen;
    })();
  }

  expireSharedInboxes() {
    this.#sharedInboxSet = null;
  }
}

@Singleton(KnownServerStore)
export class KnownServerStoreImpl extends KnownServerStore {
  constructor(
    private readonly db: DatabaseService<typeof LocalDatabaseSpec>,
    private readonly blockedServerStore: BlockedServerStoreReadOnly,
    private readonly _base: KnownServerStoreReadOnlyImpl,
  ) {
    super(_base);
  }

  async seen(fullUrl: URL, sharedInbox?: string): Promise<void> {
    const { protocol, host, hostname } = fullUrl;
    if (protocol !== "http:" && protocol !== "https:") {
      throw new TypeError(
        `Invalid protocol: ${protocol} (expected http: or https:)`,
      );
    }
    const url = `${protocol}//${host}`;
    if (sharedInbox != null) {
      const { protocol } = new URL(sharedInbox);
      if (protocol !== "http:" && protocol !== "https:") {
        throw new TypeError(
          `Invalid protocol: ${protocol} (expected http: or https:)`,
        );
      }
    }

    if (await this.blockedServerStore.blocksActivityUrl(fullUrl)) {
      log.info(`Cannot add known server: domain ${hostname} is blocked`);
      return;
    }

    return this.db.transaction(async (t) => {
      for await (
        const { sharedInbox: existingSharedInbox } of t.get("knownServer", {
          where: { url },
          returning: ["url", "sharedInbox"],
        })
      ) {
        if (sharedInbox && sharedInbox !== existingSharedInbox) {
          log.info(
            `Updating shared inbox for known server ${JSON.stringify(url)}: ${
              JSON.stringify(existingSharedInbox)
            } -> ${JSON.stringify(sharedInbox)}`,
          );
          this._base.expireSharedInboxes();
          await t.update("knownServer", { url }, {
            lastSeen: new Date(),
            sharedInbox,
          });
        } else {
          await t.update("knownServer", { url }, { lastSeen: new Date() });
        }
        return;
      }

      log.info(`Registering new known server ${JSON.stringify(url)}`);
      this._base.expireSharedInboxes();
      const now = new Date();
      await t.insert("knownServer", [{
        url,
        sharedInbox,
        firstSeen: now,
        lastSeen: now,
      }]);
    });
  }

  async delete({ protocol, host }: URL): Promise<void> {
    this._base.expireSharedInboxes();
    const url = `${protocol}//${host}`;
    await this.db.delete("knownServer", {
      url: new URL(url.toLowerCase()).host,
    });
  }

  async deleteDomain(domain: string): Promise<void> {
    this._base.expireSharedInboxes();
    const n =
      await this.db.delete("knownServer", { url: Q.ilike(`%/${domain}`) }) +
      await this.db.delete("knownServer", { url: Q.ilike(`%.${domain}`) });
    if (n > 0) {
      log.info(
        `Purged domain ${domain} from known servers: ${n} deleted`,
      );
    }
  }
}
