import {
  BlockedServer,
  BlockedServerStoreReadOnly,
} from "$/models/BlockedServerStoreReadOnly.ts";

export const BLOCKED_SERVERS: readonly BlockedServer[] = [{
  domain: "blocked.test",
  createdAt: new Date(),
  blockActivity: true,
  blockMedia: true,
  hideInFeeds: true,
}, {
  domain: "hidden.test",
  createdAt: new Date(),
  blockActivity: false,
  blockMedia: false,
  hideInFeeds: true,
}];

export class MockBlockedServerStore extends BlockedServerStoreReadOnly {
  async *list(): AsyncIterable<BlockedServer> {
    for (const server of BLOCKED_SERVERS) {
      yield server;
    }
  }

  get(domain: string): Promise<BlockedServer | null> {
    return Promise.resolve(
      BLOCKED_SERVERS.find((s) => s.domain === domain.toLowerCase()) ?? null,
    );
  }

  blocksActivityUrl({ hostname }: URL) {
    return Promise.resolve(
      BLOCKED_SERVERS.some((s) =>
        s.domain.endsWith(hostname) && s.blockActivity
      ),
    );
  }

  blocksMediaUrl({ hostname }: URL) {
    return Promise.resolve(
      BLOCKED_SERVERS.some((s) => s.domain.endsWith(hostname) && s.blockMedia),
    );
  }

  hidesUrl({ hostname }: URL) {
    return Promise.resolve(
      BLOCKED_SERVERS.some((s) => s.domain.endsWith(hostname) && s.hideInFeeds),
    );
  }

  count() {
    return Promise.resolve(BLOCKED_SERVERS.length);
  }
}
