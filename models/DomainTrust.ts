import { Status } from "$/deps.ts";
import { LogLevels, Tag } from "$/lib/error.ts";
import { InjectableAbstract, Singleton } from "$/lib/inject.ts";
import { Q } from "$/lib/sql/mod.ts";
import { chainFrom } from "$/lib/transducers.ts";
import { normalizeDomain } from "$/lib/urls.ts";
import { TrustLevel, TrustOptions } from "$/models/types.ts";
import { LocalDatabaseService } from "$/services/LocalDatabaseService.ts";

export interface DomainTrust extends TrustOptions {
  readonly domain: string;
  readonly privateNote?: string | null;
  readonly blockReason?: string | null;
  readonly friendly: boolean;
  readonly updatedAt?: Date | null;
}

export const TRUST_LEVEL_BLOCKED: TrustOptions = {
  requestToTrust: TrustLevel.BlockUnconditional,
  requestFromTrust: TrustLevel.BlockUnconditional,
  mediaTrust: TrustLevel.BlockUnconditional,
  feedTrust: TrustLevel.BlockUnconditional,
  replyTrust: TrustLevel.BlockUnconditional,
  dmTrust: TrustLevel.BlockUnconditional,
};

export const TRUST_LEVEL_DEFAULT: TrustOptions = {
  requestToTrust: TrustLevel.Unset,
  requestFromTrust: TrustLevel.Unset,
  mediaTrust: TrustLevel.Unset,
  feedTrust: TrustLevel.Unset,
  replyTrust: TrustLevel.Unset,
  dmTrust: TrustLevel.Unset,
};

export const TRUST_LEVEL_TRUSTED: TrustOptions = {
  requestToTrust: TrustLevel.Trust,
  requestFromTrust: TrustLevel.Trust,
  mediaTrust: TrustLevel.Trust,
  feedTrust: TrustLevel.Trust,
  replyTrust: TrustLevel.Trust,
  dmTrust: TrustLevel.Trust,
};

export const OutgoingRequestBlocked = new Tag("Outgoing Request Blocked", {
  level: LogLevels.INFO,
  needsStackTrace: false,
});
export const IncomingRequestBlocked = new Tag("Incoming Request Blocked", {
  httpStatus: Status.Forbidden,
  internal: false,
});
export const MediaBlocked = new Tag("Media Blocked", {
  level: LogLevels.INFO,
  needsStackTrace: false,
});
export const UpdateDomainTrustFailed = new Tag("Update Domain Trust Failed");

export function allParentDomains(domain: string): string[] {
  domain = normalizeDomain(domain);
  const domains: string[] = [];
  for (
    let i = domain.lastIndexOf(".");
    i > 0;
    i = domain.lastIndexOf(".", i - 1)
  ) {
    domains.push(domain.slice(i + 1, domain.length));
  }
  domains.push(domain);
  return domains;
}

@InjectableAbstract()
export abstract class DomainTrustStore {
  abstract list(
    where?: { friendly?: boolean; blocked?: boolean; trusted?: boolean },
  ): AsyncIterable<DomainTrust>;

  abstract count(
    where?: { friendly?: boolean; blocked?: boolean; trusted?: boolean },
  ): Promise<number>;

  abstract get(domain: string): Promise<DomainTrust>;

  async requestToTrust(url: URL) {
    return (await this.get(url.hostname)).requestToTrust;
  }

  async requestFromTrust(url: URL) {
    return (await this.get(url.hostname)).requestFromTrust;
  }

  async mediaTrust(url: URL) {
    return (await this.get(url.hostname)).mediaTrust;
  }

  async feedTrust(url: URL) {
    return (await this.get(url.hostname)).feedTrust;
  }

  async dmTrust(url: URL) {
    return (await this.get(url.hostname)).dmTrust;
  }

  async replyTrust(url: URL) {
    return (await this.get(url.hostname)).replyTrust;
  }

  abstract update(
    domain: string,
    fields: Partial<Omit<DomainTrust, "domain" | "updatedAt">>,
  ): Promise<DomainTrust>;

  abstract reset(domain: string): Promise<void>;
}

@Singleton(DomainTrustStore)
export class DomainTrustStoreImpl extends DomainTrustStore {
  constructor(private readonly db: LocalDatabaseService) {
    super();
  }

  list(
    where: { friendly?: boolean; blocked?: boolean; trusted?: boolean } = {},
  ) {
    return this.db.get("domainTrust", {
      where: {
        friendly: where.friendly,
        requestFromTrust: "blocked" in where
          ? (where.blocked
            ? Q.lte(TrustLevel.BlockUnlessFollow)
            : Q.gt(TrustLevel.BlockUnlessFollow))
          : undefined,
        replyTrust: "trusted" in where
          ? (where.trusted ? Q.gte(TrustLevel.Trust) : Q.lt(TrustLevel.Trust))
          : undefined,
      },
    });
  }

  count(
    where: { friendly?: boolean; blocked?: boolean; trusted?: boolean } = {},
  ) {
    return this.db.count("domainTrust", {
      friendly: where.friendly,
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

  async get(domain: string): Promise<DomainTrust> {
    for await (
      const r of this.db.get("domainTrust", {
        where: { domain: normalizeDomain(domain) },
        limit: 1,
      })
    ) {
      return r;
    }
    return { domain, friendly: false, ...TRUST_LEVEL_DEFAULT };
  }

  async #getTrustRecursively<Prop extends keyof TrustOptions>(
    domain: string,
    prop: Prop,
  ): Promise<TrustLevel> {
    let lastDomain = "", lastTrust = TrustLevel.Unset;
    for await (
      const r of this.db.get("domainTrust", {
        where: { domain: Q.in(allParentDomains(domain)) },
        returning: ["domain", prop],
      })
    ) {
      if (r.domain.length >= lastDomain.length) {
        lastDomain = r.domain;
        lastTrust = r[prop] as TrustLevel;
      }
    }
    return lastTrust;
  }

  requestToTrust({ hostname }: URL) {
    return this.#getTrustRecursively(hostname, "requestToTrust");
  }

  requestFromTrust({ hostname }: URL) {
    return this.#getTrustRecursively(hostname, "requestFromTrust");
  }

  mediaTrust({ hostname }: URL) {
    return this.#getTrustRecursively(hostname, "mediaTrust");
  }

  feedTrust({ hostname }: URL) {
    return this.#getTrustRecursively(hostname, "feedTrust");
  }

  dmTrust({ hostname }: URL) {
    return this.#getTrustRecursively(hostname, "dmTrust");
  }

  replyTrust({ hostname }: URL) {
    return this.#getTrustRecursively(hostname, "replyTrust");
  }

  update(
    domain: string,
    changedFields: Partial<Omit<DomainTrust, "domain" | "updatedAt">>,
  ): Promise<DomainTrust> {
    const fields = { ...changedFields, updatedAt: new Date() };
    try {
      domain = normalizeDomain(domain);
      return this.db.transaction(async (txn) => {
        const [existing] = await chainFrom(
          txn.get("domainTrust", { where: { domain }, limit: 1 }),
        ).toArray();
        if (existing) {
          await txn.update("domainTrust", { domain }, fields);
          return { ...existing, ...fields };
        } else {
          const entry: DomainTrust = {
            domain,
            friendly: false,
            ...TRUST_LEVEL_DEFAULT,
            ...fields,
          };
          await txn.insert("domainTrust", [entry]);
          return entry;
        }
      });
    } catch (e) {
      throw UpdateDomainTrustFailed.error(
        `Failed to update domainTrust entry for ${domain}`,
        e,
      );
    }
  }

  async reset(domain: string): Promise<void> {
    try {
      domain = normalizeDomain(domain);
      await this.db.delete("domainTrust", { domain });
    } catch (e) {
      throw UpdateDomainTrustFailed.error(
        `Failed to delete domainTrust entry for ${domain}`,
        e,
      );
    }
  }
}
