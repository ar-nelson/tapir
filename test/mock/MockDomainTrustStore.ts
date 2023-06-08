import { Singleton } from "$/lib/inject.ts";
import { chainFrom } from "$/lib/transducers.ts";
import { isSubdomainOf, normalizeDomain } from "$/lib/urls.ts";
import {
  DomainTrust,
  DomainTrustStore,
  TRUST_LEVEL_DEFAULT,
} from "$/models/DomainTrust.ts";
import { TrustLevel } from "$/models/types.ts";
import { DOMAIN_TRUST } from "./mock-data.ts";

@Singleton()
export class MockDomainTrustStore extends DomainTrustStore {
  async *list(
    where: { friendly?: boolean; blocked?: boolean; trusted?: boolean } = {},
  ) {
    for (const entry of Object.values(DOMAIN_TRUST)) {
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
    const found = Object.values(DOMAIN_TRUST).find((s) =>
      isSubdomainOf(s.domain, domain)
    );
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
