import { Singleton } from "$/lib/inject.ts";
import { signRequest } from "$/lib/signatures.ts";
import * as urls from "$/lib/urls.ts";
import { ServerConfigStore } from "$/models/ServerConfig.ts";
import { CONTENT_TYPE } from "$/schemas/activitypub/mod.ts";

export const USER_AGENT = "just a friendly tapir; https://tapir.social";

@Singleton()
export class HttpClientService {
  constructor(private readonly serverConfigStore: ServerConfigStore) {}

  fetch: typeof fetch = (url, opts = {}) => {
    return fetch(url, {
      ...opts,
      headers: { ...opts.headers ?? {}, "user-agent": USER_AGENT },
    });
  };

  async fetchActivityPub(
    personaName: string,
    url: RequestInfo | URL,
    opts: RequestInit = {},
  ): Promise<Response> {
    const serverConfig = await this.serverConfigStore.getServerConfig(),
      req = new Request(url, {
        ...opts,
        headers: {
          ...opts.headers ?? {},
          "user-agent": USER_AGENT,
          "accept": CONTENT_TYPE,
        },
      }),
      signedReq = await signRequest(
        req,
        `${urls.activityPubRoot(personaName, serverConfig.url)}#main-key`,
        serverConfig.privateKey,
      );
    return fetch(signedReq);
  }
}
