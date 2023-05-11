import { chainFrom } from "$/lib/transducers.ts";
import { isSubdomainOf, normalizeDomain } from "$/lib/urls.ts";
import {
  DomainTrust,
  DomainTrustStore,
  TRUST_LEVEL_BLOCKED,
  TRUST_LEVEL_DEFAULT,
  TRUST_LEVEL_TRUSTED,
} from "$/models/DomainTrust.ts";
import { TrustLevel } from "$/models/types.ts";

export const DEFAULT_SERVERS: readonly DomainTrust[] = [{
  domain: "blocked.test.",
  friendly: false,
  ...TRUST_LEVEL_BLOCKED,
}, {
  domain: "default.test.",
  friendly: false,
  ...TRUST_LEVEL_DEFAULT,
}, {
  domain: "trusted.test.",
  friendly: true,
  ...TRUST_LEVEL_TRUSTED,
}];

export class MockDomainTrustStore extends DomainTrustStore {
  async *list(
    where: { friendly?: boolean; blocked?: boolean; trusted?: boolean } = {},
  ) {
    for (const entry of DEFAULT_SERVERS) {
      if (where.friendly != null && entry.friendly !== where.friendly) continue;
      if (
        where.blocked != null &&
        (entry.requestFromTrust <= TrustLevel.BlockUnlessFollow) !==
          where.blocked
      ) continue;
      if (
        where.trusted != null &&
        (entry.replyTrust > TrustLevel.Unset) !== where.trusted
      ) continue;
      yield entry;
    }
  }

  count(
    where?: { friendly?: boolean; blocked?: boolean; trusted?: boolean },
  ) {
    return chainFrom(this.list(where)).count();
  }

  get(domain: string): Promise<DomainTrust> {
    domain = normalizeDomain(domain);
    const found = DEFAULT_SERVERS.find((s) => isSubdomainOf(s.domain, domain));
    return Promise.resolve(
      found ?? {
        domain,
        friendly: false,
        ...TRUST_LEVEL_DEFAULT,
      },
    );
  }

  update(): Promise<DomainTrust> {
    throw new Error("Method not implemented.");
  }

  reset(): Promise<void> {
    throw new Error("Method not implemented.");
  }
}
