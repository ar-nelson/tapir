import { Singleton } from "$/lib/inject.ts";
import { chainFrom } from "$/lib/transducers.ts";
import {
  isSubdomainOf,
  normalizeDomain,
  protoAddrInstance,
} from "$/lib/urls.ts";
import {
  DomainTrustStore,
  TRUST_LEVEL_DEFAULT,
  TRUST_LEVEL_TRUSTED,
} from "$/models/DomainTrust.ts";
import {
  DelegatingProfileTrustStore,
  ProfileTrust,
} from "$/models/ProfileTrust.ts";
import { TapirConfig } from "$/models/TapirConfig.ts";
import {
  ProtoAddr,
  protoAddrToString,
  Protocol,
  TrustLevel,
} from "$/models/types.ts";
import { PROFILE_TRUST } from "./mock-data.ts";

@Singleton()
export class MockProfileTrustStore extends DelegatingProfileTrustStore {
  constructor(config: TapirConfig, domainTrustStore: DomainTrustStore) {
    super(config, domainTrustStore);
  }

  async *list(
    { domain, blocked, trusted }: {
      domain?: string | undefined;
      blocked?: boolean | undefined;
      trusted?: boolean | undefined;
    } = {},
  ): AsyncIterable<ProfileTrust> {
    for (const trust of Object.values(PROFILE_TRUST)) {
      if (domain && (!trust.domain || !isSubdomainOf(domain, trust.domain))) {
        continue;
      }
      if (
        blocked != null &&
        blocked !== trust.requestFromTrust <= TrustLevel.BlockUnlessFollow
      ) continue;
      if (trusted != null && trusted !== trust.replyTrust >= TrustLevel.Trust) {
        continue;
      }
      yield trust;
    }
  }

  count(
    params: {
      domain?: string | undefined;
      blocked?: boolean | undefined;
      trusted?: boolean | undefined;
    } = {},
  ): Promise<number> {
    return chainFrom(this.list(params)).count();
  }

  get(addr: ProtoAddr): Promise<ProfileTrust> {
    if (addr.protocol === Protocol.Local) {
      return Promise.resolve({
        addr,
        domain: normalizeDomain(this.config.domain),
        ...TRUST_LEVEL_TRUSTED,
      });
    }
    const addrString = protoAddrToString(addr),
      trust = (PROFILE_TRUST as Record<string, ProfileTrust>)[addrString];
    return Promise.resolve(
      trust ?? {
        addr,
        domain: protoAddrInstance(addr, this.config),
        ...TRUST_LEVEL_DEFAULT,
      },
    );
  }

  update(): Promise<ProfileTrust> {
    throw new Error("Method not implemented.");
  }

  reset(): Promise<void> {
    throw new Error("Method not implemented.");
  }
}
