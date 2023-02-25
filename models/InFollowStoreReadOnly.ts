// in a separate file to break a dependency cycle
import { InjectableAbstract, Singleton } from "$/lib/inject.ts";
import { Q } from "$/lib/sql/mod.ts";
import { LocalDatabaseService } from "$/services/LocalDatabaseService.ts";
import { KnownServerStoreReadOnly } from "$/models/KnownServer.ts";

export interface InFollow {
  readonly id: string;
  readonly actor: string;
  readonly name: string;
  readonly persona: string;
  readonly server: string;
  readonly inbox: string;
  readonly createdAt: Date;
  readonly acceptedAt: Date | null;
}

@InjectableAbstract()
export abstract class InFollowStoreReadOnly {
  abstract listFollowers(persona: string): AsyncIterable<InFollow>;

  abstract listRequests(persona: string): AsyncIterable<InFollow>;

  abstract listFollowerInboxes(persona: string): Promise<ReadonlySet<string>>;

  abstract get(
    params: { id: string } | { actor: string; persona: string },
  ): Promise<InFollow | null>;

  abstract countFollowers(persona: string): Promise<number>;

  abstract countRequests(persona: string): Promise<number>;
}

@Singleton(InFollowStoreReadOnly)
export class InFollowStoreReadOnlyImpl extends InFollowStoreReadOnly {
  #followerInboxSet: Promise<ReadonlySet<string>> | null = null;

  constructor(
    private readonly db: LocalDatabaseService,
    private readonly knownServerStore: KnownServerStoreReadOnly,
  ) {
    super();
  }

  listFollowers(persona: string): AsyncIterable<InFollow> {
    return this.db.get("inFollow", {
      where: { acceptedAt: Q.notNull(), persona },
    });
  }

  listRequests(persona: string): AsyncIterable<InFollow> {
    return this.db.get("inFollow", {
      where: { acceptedAt: Q.null(), persona },
    });
  }

  listFollowerInboxes(persona: string): Promise<ReadonlySet<string>> {
    if (this.#followerInboxSet) return this.#followerInboxSet;
    return this.#followerInboxSet = (async () => {
      const inboxen = new Set<string>(), skipServers = new Set<string>();
      for await (
        const { server, inbox } of this.db.get("inFollow", {
          where: { acceptedAt: Q.notNull(), persona },
        })
      ) {
        if (skipServers.has(server)) continue;
        const knownServer = await this.knownServerStore.get(new URL(server));
        if (knownServer && knownServer.sharedInbox) {
          inboxen.add(knownServer.sharedInbox);
          skipServers.add(server);
        } else {
          inboxen.add(inbox);
        }
      }
      return inboxen;
    })();
  }

  async get(
    params: { id: string } | { actor: string; persona: string },
  ): Promise<InFollow | null> {
    for await (
      const p of this.db.get("inFollow", { where: params, limit: 1 })
    ) {
      return p;
    }
    return null;
  }

  countFollowers(persona: string): Promise<number> {
    return this.db.count("inFollow", { acceptedAt: Q.notNull(), persona });
  }

  countRequests(persona: string): Promise<number> {
    return this.db.count("inFollow", { acceptedAt: Q.null(), persona });
  }

  expireFollowerInboxes() {
    this.#followerInboxSet = null;
  }
}
