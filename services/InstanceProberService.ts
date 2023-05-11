import { logError, LogLevels, Tag } from "$/lib/error.ts";
import {
  DEFAULT_SOFTWARE_FEATURES,
  SOFTWARE_FEATURES,
} from "$/lib/softwareFeatures.ts";
import * as urls from "$/lib/urls.ts";
import { Protocol, RemoteInstance } from "$/models/types.ts";
import { assertIsInstance, Instance } from "$/schemas/mastodon/mod.ts";
import {
  assertIsNodeInfoDirectory,
  assertIsNodeInfoV2,
  NodeInfoV2,
} from "$/schemas/nodeinfo/mod.ts";
import {
  DispatchFailed,
  HttpDispatcher,
  Priority,
} from "$/services/HttpDispatcher.ts";

export const BadInstance = new Tag("Bad Instance", {
  level: LogLevels.WARNING,
});
const NoNodeInfo = new Tag("No NodeInfo", {
  level: LogLevels.INFO,
  needsStackTrace: false,
});
const NoPublicMastodonApi = new Tag("No Public Mastodon API", {
  level: LogLevels.INFO,
  needsStackTrace: false,
});

export abstract class InstanceProberService {
  abstract probe(url: URL, priority?: Priority): Promise<RemoteInstance>;
}

export class InstanceProberServiceImpl extends InstanceProberService {
  constructor(
    private readonly httpDispatcher: HttpDispatcher,
  ) {
    super();
  }

  async #getNodeInfo(url: URL, priority: Priority): Promise<NodeInfoV2> {
    const directoryUrl = new URL(urls.nodeInfoDirectory, url),
      directoryResponse = await this.httpDispatcher.dispatchAndWait(
        new Request(directoryUrl, {
          headers: { "accept": "application/json" },
        }),
        { priority, throwOnError: NoNodeInfo },
      );
    const directory = await directoryResponse.json();
    assertIsNodeInfoDirectory(directory);
    const nodeInfoUrl =
      (directory.links.find((l) =>
        l.rel === "http://nodeinfo.diaspora.software/ns/schema/2.1"
      ) ?? directory.links.find((l) =>
        l.rel === "http://nodeinfo.diaspora.software/ns/schema/2.0"
      ))?.href;
    if (!nodeInfoUrl) {
      throw NoNodeInfo.error(
        `NodeInfo directory at ${directoryUrl} does not have a NodeInfo 2.x link`,
      );
    }
    const nodeInfoResponse = await this.httpDispatcher.dispatchAndWait(
      new Request(nodeInfoUrl, { headers: { "accept": "application/json" } }),
      { priority, throwOnError: NoNodeInfo },
    );
    const nodeInfo = await nodeInfoResponse.json();
    assertIsNodeInfoV2(nodeInfo);
    return nodeInfo;
  }

  async #getMastodonInstance(url: URL, priority: Priority): Promise<Instance> {
    const instanceUrl = new URL("/api/v1/instance", url),
      instanceResponse = await this.httpDispatcher.dispatchAndWait(
        new Request(instanceUrl, {
          headers: { "accept": "application/json" },
        }),
        { priority, throwOnError: DispatchFailed },
      ),
      instance = await instanceResponse.json();
    assertIsInstance(instance);
    return instance;
  }

  async #testMastodonApiAvailability(
    url: URL,
    priority: Priority,
  ): Promise<void> {
    const feedUrl = new URL("/api/v1/timelines/public", url);
    await this.httpDispatcher.dispatchAndWait(
      new Request(feedUrl, {
        headers: { "accept": "application/json" },
      }),
      {
        priority,
        throwOnError: NoPublicMastodonApi,
        errorMessage: `Error when fetching Mastodon public timeline for ${url}`,
      },
    );
  }

  async probe(
    url: URL,
    priority = Priority.Immediate,
  ): Promise<RemoteInstance> {
    let nodeInfo: NodeInfoV2 | null = null, instance: Instance | null = null;
    try {
      nodeInfo = await this.#getNodeInfo(url, priority);
    } catch (e) {
      logError(`Failed to load nodeinfo for server ${url}`, e);
    }
    try {
      const software =
          (nodeInfo && SOFTWARE_FEATURES[nodeInfo.software.name]) ??
            DEFAULT_SOFTWARE_FEATURES,
        version = nodeInfo?.version ?? "",
        features = software.features.reduce(
          (last, next) => {
            // TODO: Compare versions with an actual algorithm, like semver
            if (next.minVersion && version < next.minVersion) return last;
            if (next.versionSuffix && !version.endsWith(next.versionSuffix)) {
              return last;
            }
            return {
              ...last,
              ...next,
              flags: {
                ...last.flags,
                ...next.flags,
              },
            };
          },
          { flags: {} } as (typeof software)["features"][number],
        );
      if (features.mastodonApi !== false) {
        try {
          instance = await this.#getMastodonInstance(url, priority);
        } catch (e) {
          if (features.mastodonApi === true) {
            logError(
              `Failed to load Mastodon instance info for server ${url}`,
              e,
            );
          }
        }
      }
      if (instance) {
        let mastodonApi = true;
        try {
          await this.#testMastodonApiAvailability(
            url,
            priority,
          );
        } catch (e) {
          logError("Assuming Mastodon API is unavailable", e);
          mastodonApi = false;
        }
        return {
          url: instance.uri,
          displayName: instance.title,
          shortDescription: instance.short_description,
          description: instance.description,
          software: software.displayName,
          softwareVersion: nodeInfo?.software?.version,
          instanceMetadata: {
            protocols: mastodonApi
              ? { [Protocol.Mastodon]: true, [Protocol.ActivityPub]: true }
              : { [Protocol.ActivityPub]: true },
            features: features.flags,
            defaultStyle: software.defaultStyle,
            stats: {
              users: instance.stats.user_count,
              posts: instance.stats.status_count,
            },
            rules: instance.rules,
            adminEmail: instance.email,
            feeds: mastodonApi
              ? software.feeds
              : (software.feeds ?? []).filter((f) =>
                f.addr.protocol !== Protocol.Mastodon
              ),
            admins: mastodonApi
              ? [{
                protocol: Protocol.Mastodon,
                path: instance.contact_account.acct,
              }]
              : [],
          },
          logoUrl: instance.thumbnail ?? undefined,
          lastSeen: new Date(),
        };
      } else if (nodeInfo) {
        return {
          url: url.href,
          software: software.displayName,
          softwareVersion: nodeInfo.software.version,
          instanceMetadata: {
            protocols: {
              [Protocol.ActivityPub]: nodeInfo.protocols.includes(
                "activitypub",
              ),
            },
            features: features.flags,
            defaultStyle: software.defaultStyle,
            stats: {
              users: nodeInfo.usage.users.total,
              posts: nodeInfo.usage.localPosts,
            },
            feeds: software.feeds,
          },
          lastSeen: new Date(),
        };
      }
    } catch (e) {
      throw BadInstance.wrap(e);
    }
    throw BadInstance.error(
      `Did not find an instance at ${url} (no nodeinfo or Mastodon API)`,
    );
  }
}
