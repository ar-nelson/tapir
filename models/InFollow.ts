import { log, Status } from "$/deps.ts";
import { LogLevels, Tag } from "$/lib/error.ts";
import { InjectableAbstract, Singleton } from "$/lib/inject.ts";
import { ColumnsOf, OutRow, Q, Query } from "$/lib/sql/mod.ts";
import { chainFrom } from "$/lib/transducers.ts";
import { mapAsyncIterable } from "$/lib/utils.ts";
import { PersonaStore } from "$/models/Persona.ts";
import {
  InFollow,
  parseProtoAddr,
  ProtoAddr,
  protoAddrToString,
} from "$/models/types.ts";
import { LocalDatabaseTables } from "$/schemas/tapir/db/local/mod.ts";
import { LocalDatabaseService } from "$/services/LocalDatabaseService.ts";
import { PublisherService } from "$/services/PublisherService.ts";

@InjectableAbstract()
export abstract class InFollowStore {
  abstract listFollowers(persona: string): AsyncIterable<InFollow>;

  abstract listRequests(persona: string): AsyncIterable<InFollow>;

  abstract get(
    params: { id: number } | { remoteActivity: string } | {
      remoteProfile: ProtoAddr;
      persona: string;
    },
  ): Promise<InFollow>;

  abstract countFollowers(persona: string): Promise<number>;

  abstract countRequests(persona: string): Promise<number>;

  abstract create(
    params: {
      remoteActivity?: string;
      remoteProfile: ProtoAddr;
      persona: string;
      public?: boolean;
    },
  ): Promise<void>;

  abstract accept(
    params: { id: number } | { remoteActivity: string } | {
      remoteProfile: ProtoAddr;
      persona: string;
    },
  ): Promise<void>;

  abstract reject(
    params: { id: number } | { remoteActivity: string } | {
      remoteProfile: ProtoAddr;
      persona: string;
    },
  ): Promise<void>;

  abstract delete(
    params: { id: number } | { remoteActivity: string } | {
      remoteProfile: ProtoAddr;
      persona: string;
    },
  ): Promise<void>;

  abstract deleteAllForPersona(persona: string): Promise<void>;

  abstract onChange(listener: () => void): void;
}

export const InFollowNotFound = new Tag("Follower Not Found");
export const DuplicateFollow = new Tag("Duplicate Follow", {
  level: LogLevels.WARNING,
  internal: false,
  httpStatus: Status.Conflict,
});
export const CreateInFollowFailed = new Tag("Create In-Follow Failed");
export const UpdateInFollowFailed = new Tag("Update In-Follow Failed");
export const DeleteInFollowFailed = new Tag("Delete In-Follow Failed");

function dbToTs(
  row: OutRow<ColumnsOf<LocalDatabaseTables, "inFollow">>,
): InFollow {
  return {
    ...row,
    remoteProfile: parseProtoAddr(row.remoteProfile),
    remoteActivity: row.remoteActivity ?? undefined,
    acceptedAt: row.acceptedAt ?? undefined,
  };
}

@Singleton(InFollowStore)
export class InFollowStoreImpl extends InFollowStore {
  #changeListeners = new Set<() => void>();

  constructor(
    private readonly db: LocalDatabaseService,
    private readonly personaStore: PersonaStore,
    private readonly publisherService: PublisherService,
  ) {
    super();
  }

  #query(
    params: { id: number } | { remoteActivity: string } | {
      remoteProfile: ProtoAddr;
      persona: string;
    },
  ): Query<ColumnsOf<LocalDatabaseTables, "inFollow">> {
    if ("remoteProfile" in params) {
      return {
        ...params,
        remoteProfile: protoAddrToString(params.remoteProfile),
      };
    }
    return params;
  }

  listFollowers(persona: string) {
    return mapAsyncIterable(
      this.db.get("inFollow", {
        where: { acceptedAt: Q.notNull(), persona },
      }),
      dbToTs,
    );
  }

  listRequests(persona: string) {
    return mapAsyncIterable(
      this.db.get("inFollow", {
        where: { acceptedAt: Q.null(), persona },
      }),
      dbToTs,
    );
  }

  async get(
    params: { id: number } | { remoteActivity: string } | {
      remoteProfile: ProtoAddr;
      persona: string;
    },
  ) {
    for await (
      const p of this.db.get("inFollow", {
        where: this.#query(params),
        limit: 1,
      })
    ) {
      return dbToTs(p);
    }
    throw InFollowNotFound.error(
      `No follow ${
        "id" in params
          ? `with ID ${params.id}`
          : "remoteActivity" in params
          ? `with activity ID ${JSON.stringify(params.remoteActivity)}`
          : `from profile ${
            JSON.stringify(protoAddrToString(params.remoteProfile))
          } to persona ${JSON.stringify(params.persona)}`
      }`,
    );
  }

  countFollowers(persona: string): Promise<number> {
    return this.db.count("inFollow", { acceptedAt: Q.notNull(), persona });
  }

  countRequests(persona: string): Promise<number> {
    return this.db.count("inFollow", { acceptedAt: Q.null(), persona });
  }

  async create(
    params: {
      remoteActivity?: string;
      remoteProfile: ProtoAddr;
      persona: string;
      public?: boolean;
    },
  ): Promise<void> {
    try {
      const { requestToFollow } = await this.personaStore.get(params.persona),
        addrString = protoAddrToString(params.remoteProfile);
      log.info(`New follow from ${addrString} to persona ${params.persona}`);
      const now = new Date(),
        follow = await this.db.transaction(async (t) => {
          for await (
            const { createdAt } of t.get("inFollow", {
              where: { remoteProfile: addrString, persona: params.persona },
              limit: 1,
              returning: ["createdAt"],
            })
          ) {
            throw DuplicateFollow.error(
              `Follow from ${addrString} -> ${params.persona} already exists (at ${createdAt})`,
            );
          }
          const follow = {
            ...params,
            public: !!params.public,
            createdAt: now,
            acceptedAt: requestToFollow ? undefined : now,
          };
          await t.insert("inFollow", [{
            ...follow,
            remoteProfile: addrString,
          }]);
          return follow;
        });
      if (!requestToFollow) {
        await this.#onAccept(follow);
      }
    } catch (e) {
      throw CreateInFollowFailed.wrap(e);
    }
  }

  async #onAccept(follow: Omit<InFollow, "id">) {
    await this.publisherService.acceptInFollow(follow);
    this.#changeListeners.forEach((f) => f());
    await this.publisherService.publishPostHistory(
      follow.persona,
      follow.remoteProfile,
    );
  }

  async accept(
    params: { id: number } | { remoteActivity: string } | {
      remoteProfile: ProtoAddr;
      persona: string;
    },
  ): Promise<void> {
    const updated = await this.db.transaction(async (txn) => {
      const [existing] = await chainFrom(
        txn.get("inFollow", {
          where: { ...this.#query(params), acceptedAt: Q.null() },
          limit: 1,
        }),
      ).toArray();
      if (existing == null) {
        throw InFollowNotFound.error(
          `No existing follow request matches ${JSON.stringify(params)}`,
        );
      }
      const now = new Date();
      await txn.update("inFollow", { id: existing.id }, { acceptedAt: now });
      return { ...existing, acceptedAt: now };
    });
    await this.#onAccept(dbToTs(updated));
  }

  async reject(
    params: { id: number } | { remoteActivity: string } | {
      remoteProfile: ProtoAddr;
      persona: string;
    },
  ): Promise<void> {
    const updated = await this.db.transaction(async (txn) => {
      const [existing] = await chainFrom(
        txn.get("inFollow", {
          where: { ...this.#query(params), acceptedAt: Q.null() },
          limit: 1,
        }),
      ).toArray();
      if (existing == null) {
        throw InFollowNotFound.error(
          `No existing follow request matches ${JSON.stringify(params)}`,
        );
      }
      await txn.delete("inFollow", this.#query(params));
      return existing;
    });
    await this.publisherService.rejectInFollow(dbToTs(updated));
    this.#changeListeners.forEach((f) => f());
  }

  async delete(
    params: { id: number } | { remoteActivity: string } | {
      remoteProfile: ProtoAddr;
      persona: string;
    },
  ): Promise<void> {
    await this.db.transaction(async (txn) => {
      const [existing] = await chainFrom(
        txn.get("inFollow", {
          where: { ...this.#query(params), acceptedAt: Q.null() },
          limit: 1,
        }),
      ).toArray();
      if (existing == null) {
        throw InFollowNotFound.error(
          `No existing follow request matches ${JSON.stringify(params)}`,
        );
      }
      await txn.delete("inFollow", this.#query(params));
    });
    this.#changeListeners.forEach((f) => f());
  }

  async deleteAllForPersona(persona: string) {
    await this.db.delete("inFollow", { persona });
  }

  onChange(listener: () => void) {
    this.#changeListeners.add(listener);
  }
}
