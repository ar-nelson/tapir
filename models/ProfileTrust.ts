import { Tag } from "$/lib/error.ts";
import { InjectableAbstract, Singleton } from "$/lib/inject.ts";
import { ColumnsOf, OutRow, Q } from "$/lib/sql/mod.ts";
import { chainFrom } from "$/lib/transducers.ts";
import { normalizeDomain, protoAddrInstance } from "$/lib/urls.ts";
import { DomainTrustStore, TRUST_LEVEL_DEFAULT } from "$/models/DomainTrust.ts";
import { TapirConfig } from "$/models/TapirConfig.ts";
import {
  parseProtoAddr,
  ProtoAddr,
  protoAddrToString,
  Protocol,
  TrustLevel,
  TrustOptions,
} from "$/models/types.ts";
import { LocalDatabaseTables } from "$/schemas/tapir/db/local/mod.ts";
import { LocalDatabaseService } from "$/services/LocalDatabaseService.ts";

export const UpdateProfileTrustFailed = new Tag("Update Profile Trust Failed");

export interface ProfileTrust extends TrustOptions {
  readonly addr: ProtoAddr;
  readonly domain?: string | null;
  readonly privateNote?: string | null;
  readonly updatedAt?: Date | null;
}

@InjectableAbstract()
export abstract class ProfileTrustStore {
  abstract list(
    where?: { domain?: string; blocked?: boolean; trusted?: boolean },
  ): AsyncIterable<ProfileTrust>;

  abstract count(
    where?: { domain?: string; blocked?: boolean; trusted?: boolean },
  ): Promise<number>;

  abstract get(addr: ProtoAddr): Promise<ProfileTrust>;

  abstract requestToTrust(addr: ProtoAddr): Promise<TrustLevel>;

  abstract requestFromTrust(addr: ProtoAddr): Promise<TrustLevel>;

  abstract mediaTrust(addr: ProtoAddr): Promise<TrustLevel>;

  abstract feedTrust(addr: ProtoAddr): Promise<TrustLevel>;

  abstract dmTrust(addr: ProtoAddr): Promise<TrustLevel>;

  abstract replyTrust(addr: ProtoAddr): Promise<TrustLevel>;

  abstract update(
    addr: ProtoAddr,
    fields: Partial<Omit<ProfileTrust, "addr" | "domain" | "updatedAt">>,
  ): Promise<ProfileTrust>;

  abstract reset(addr: ProtoAddr): Promise<void>;
}

export abstract class DelegatingProfileTrustStore extends ProfileTrustStore {
  constructor(
    protected readonly config: TapirConfig,
    protected readonly domainTrustStore: DomainTrustStore,
  ) {
    super();
  }

  async #getTrustRecursively<Prop extends keyof TrustOptions>(
    addr: ProtoAddr,
    prop: Prop,
  ): Promise<TrustLevel> {
    if (addr.protocol === Protocol.Local) return TrustLevel.Trust;
    const instance = protoAddrInstance(addr, this.config),
      trust = await this.get(addr),
      domain = trust.domain == null
        ? (
          instance == null
            ? undefined
            : normalizeDomain(new URL(instance).hostname)
        )
        : trust.domain,
      profileTrust = trust[prop];
    if (profileTrust === TrustLevel.BlockUnconditional) return profileTrust;
    if (domain == null) return profileTrust;
    switch (await this.domainTrustStore[prop](new URL(`https://${domain}`))) {
      case TrustLevel.BlockUnconditional:
        return TrustLevel.BlockUnconditional;
      case TrustLevel.BlockUnlessFollow:
        return profileTrust === TrustLevel.Trust
          ? TrustLevel.Trust
          : TrustLevel.BlockUnlessFollow;
      case TrustLevel.Trust:
        return profileTrust < TrustLevel.Unset
          ? profileTrust
          : TrustLevel.Trust;
    }
    return profileTrust;
  }

  requestToTrust(addr: ProtoAddr) {
    return this.#getTrustRecursively(addr, "requestToTrust");
  }

  requestFromTrust(addr: ProtoAddr) {
    return this.#getTrustRecursively(addr, "requestFromTrust");
  }

  mediaTrust(addr: ProtoAddr) {
    return this.#getTrustRecursively(addr, "mediaTrust");
  }

  feedTrust(addr: ProtoAddr) {
    return this.#getTrustRecursively(addr, "feedTrust");
  }

  dmTrust(addr: ProtoAddr) {
    return this.#getTrustRecursively(addr, "dmTrust");
  }

  replyTrust(addr: ProtoAddr) {
    return this.#getTrustRecursively(addr, "replyTrust");
  }
}

// TODO: Resolve proxies
// Proxies are tricky, and might need to be stored in the local DB

@Singleton(ProfileTrustStore)
export class ProfileTrustStoreImpl extends DelegatingProfileTrustStore {
  constructor(
    private readonly db: LocalDatabaseService,
    config: TapirConfig,
    domainTrustStore: DomainTrustStore,
  ) {
    super(config, domainTrustStore);
  }

  #rowToObject(
    row: OutRow<ColumnsOf<LocalDatabaseTables, "profileTrust">>,
  ): ProfileTrust {
    return {
      ...row,
      addr: parseProtoAddr(row.addr),
    };
  }

  async *list(
    where: { domain?: string; blocked?: boolean; trusted?: boolean } = {},
  ) {
    for await (
      const row of this.db.get("profileTrust", {
        where: {
          domain: where.domain == null
            ? undefined
            : normalizeDomain(where.domain),
          requestFromTrust: "blocked" in where
            ? (where.blocked
              ? Q.lte(TrustLevel.BlockUnlessFollow)
              : Q.gt(TrustLevel.BlockUnlessFollow))
            : undefined,
          replyTrust: "trusted" in where
            ? (where.trusted ? Q.gte(TrustLevel.Trust) : Q.lt(TrustLevel.Trust))
            : undefined,
        },
      })
    ) {
      yield this.#rowToObject(row);
    }
  }

  count(
    where: { domain?: string; blocked?: boolean; trusted?: boolean } = {},
  ) {
    return this.db.count("profileTrust", {
      domain: where.domain == null ? undefined : normalizeDomain(where.domain),
      requestFromTrust: "blocked" in where
        ? (where.blocked
          ? Q.lte(TrustLevel.BlockUnlessFollow)
          : Q.gt(TrustLevel.BlockUnlessFollow))
        : undefined,
      replyTrust: "trusted" in where
        ? (where.trusted ? Q.gte(TrustLevel.Trust) : Q.lt(TrustLevel.Trust))
        : undefined,
    });
  }

  async get(addr: ProtoAddr): Promise<ProfileTrust> {
    for await (
      const row of this.db.get("profileTrust", {
        where: { addr: protoAddrToString(addr) },
        limit: 1,
      })
    ) {
      return this.#rowToObject(row);
    }
    return { addr, ...TRUST_LEVEL_DEFAULT };
  }

  update(
    fullAddr: ProtoAddr,
    changedFields: Partial<Omit<ProfileTrust, "addr" | "domain" | "updatedAt">>,
  ): Promise<ProfileTrust> {
    const addr = protoAddrToString(fullAddr),
      fields = { ...changedFields, updatedAt: new Date() };
    try {
      return this.db.transaction(async (txn) => {
        const [existing] = await chainFrom(
          txn.get("profileTrust", { where: { addr }, limit: 1 }),
        ).toArray();
        if (existing) {
          await txn.update("profileTrust", { addr }, fields);
          return this.#rowToObject({ ...existing, ...fields });
        } else {
          const instance = protoAddrInstance(fullAddr, this.config),
            entry = {
              addr,
              domain: instance == null
                ? undefined
                : normalizeDomain(new URL(instance).hostname),
              ...TRUST_LEVEL_DEFAULT,
              ...fields,
            };
          await txn.insert("profileTrust", [entry]);
          return { ...entry, addr: fullAddr };
        }
      });
    } catch (e) {
      throw UpdateProfileTrustFailed.error(
        `Failed to update profileTrust entry for ${addr}`,
        e,
      );
    }
  }

  async reset(fullAddr: ProtoAddr): Promise<void> {
    const addr = protoAddrToString(fullAddr);
    try {
      await this.db.delete("profileTrust", { addr });
    } catch (e) {
      throw UpdateProfileTrustFailed.error(
        `Failed to delete profileTrust entry for ${addr}`,
        e,
      );
    }
  }
}
