import { log, Status } from "$/deps.ts";
import { DateDiff, datetime } from "$/lib/datetime/mod.ts";
import { LogLevels, Tag } from "$/lib/error.ts";
import { SOFTWARE_FEATURES } from "$/lib/softwareFeatures.ts";
import { Q } from "$/lib/sql/mod.ts";
import {
  DomainTrustStore,
  OutgoingRequestBlocked,
} from "$/models/DomainTrust.ts";
import { InstanceConfigStore } from "$/models/InstanceConfig.ts";
import { LocalPostStore } from "$/models/LocalPost.ts";
import { PersonaStore } from "$/models/Persona.ts";
import { TapirConfig } from "$/models/TapirConfig.ts";
import {
  DisplayStyle,
  Protocol,
  RemoteInstance,
  TrustLevel,
} from "$/models/types.ts";
import buildMeta from "$/resources/buildMeta.json" assert { type: "json" };
import { Priority } from "$/services/HttpDispatcher.ts";
import { InstanceProberService } from "$/services/InstanceProberService.ts";
import { RemoteDatabaseService } from "$/services/RemoteDatabaseService.ts";

export type { RemoteInstance };

export const InstanceNotFound = new Tag("Instance Not Found", {
  level: LogLevels.INFO,
  needsStackTrace: false,
  internal: false,
  httpStatus: Status.NotFound,
});

export abstract class RemoteInstanceStore {
  abstract get(
    url: URL,
    refresh?: boolean,
    priority?: Priority,
  ): Promise<RemoteInstance>;

  abstract delete(urls: URL | string[]): Promise<void>;
}

const EXPIRATION: DateDiff = { weeks: 1 };

export class RemoteInstanceStoreImpl extends RemoteInstanceStore {
  constructor(
    private readonly config: TapirConfig,
    private readonly instanceConfigStore: InstanceConfigStore,
    private readonly personaStore: PersonaStore,
    private readonly localPostStore: LocalPostStore,
    private readonly domainTrustStore: DomainTrustStore,
    private readonly instanceProber: InstanceProberService,
    private readonly db: RemoteDatabaseService,
  ) {
    super();
  }

  #inflight = new Map<string, Promise<RemoteInstance>>();

  async #fetchSelf(): Promise<RemoteInstance> {
    const instanceConfig = await this.instanceConfigStore.get();
    return {
      url: this.config.url,
      displayName: instanceConfig.displayName,
      shortDescription: instanceConfig.summary,
      description: instanceConfig.summary,
      software: buildMeta.name,
      softwareVersion: buildMeta.version,
      instanceMetadata: {
        protocols: {
          [Protocol.Local]: true,
          [Protocol.ActivityPub]: true,
          [Protocol.Mastodon]: true,
        },
        features: SOFTWARE_FEATURES.tapir.features[0].flags,
        defaultStyle: DisplayStyle.Microblog,
        stats: {
          users: await this.personaStore.count(),
          posts: await this.localPostStore.count(),
        },
        adminEmail: instanceConfig.adminEmail,
        admins: [{
          protocol: Protocol.Local,
          path: `@${(await this.personaStore.getMain()).name}`,
        }],
      },
      lastSeen: new Date(),
    };
  }

  async #fetch(
    url: URL,
    priority?: Priority,
  ): Promise<RemoteInstance> {
    if (url.href.startsWith(this.config.url)) return this.#fetchSelf();
    return await this.instanceProber.probe(url, priority);
  }

  async get(
    url: URL,
    refresh = false,
    priority?: Priority,
  ): Promise<RemoteInstance> {
    if (
      await this.domainTrustStore.requestToTrust(url) <=
        TrustLevel.BlockUnlessFollow
    ) {
      throw OutgoingRequestBlocked.error(`Request to ${url} blocked`);
    }
    const inflight = this.#inflight.get(url.href);
    if (inflight) return inflight;
    let existing: RemoteInstance | undefined, mustUpdate = false;
    for await (
      const e of this.db.get("instance", {
        where: { url: url.href },
        limit: 1,
      })
    ) {
      mustUpdate = true;
      if (
        !refresh && datetime(e.lastSeen).add(EXPIRATION).isAfter(datetime())
      ) {
        existing = e;
      } else if (!refresh) {
        log.info(`Instance metadata for ${url} is stale; re-fetching instance`);
      }
    }
    if (existing) {
      return existing;
    }
    const request = (async () => {
      try {
        const fetched = await this.#fetch(url, priority);
        if (mustUpdate) {
          const { url, ...rest } = fetched;
          await this.db.update("instance", { url }, rest);
        } else {
          await this.db.insert("instance", [fetched]);
        }
        return fetched;
      } catch (e) {
        throw InstanceNotFound.error(
          `Failed to fetch remote instance at ${url}`,
          e,
        );
      } finally {
        this.#inflight.delete(url.href);
      }
    })();
    this.#inflight.set(url.href, request);
    return request;
  }

  async delete(urls: URL | string[]): Promise<void> {
    if (Array.isArray(urls)) {
      await this.db.delete("instance", { url: Q.in(urls) });
    } else {
      await (this.#inflight.get(urls.href) ?? Promise.resolve()).catch(
        () => {},
      );
      await this.db.delete("instance", { url: urls.href });
    }
  }
}
