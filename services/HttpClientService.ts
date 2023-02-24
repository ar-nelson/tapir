import { Singleton } from "$/lib/inject.ts";

export const USER_AGENT = "just a friendly tapir; https://tapir.social";

@Singleton()
export class HttpClientService {
  fetch: typeof fetch = (urlOrReq, opts = {}) => {
    if (urlOrReq instanceof Request) {
      urlOrReq.headers.set("user-agent", USER_AGENT);
      return fetch(urlOrReq);
    }
    return fetch(urlOrReq, {
      ...opts,
      headers: { ...opts.headers ?? {}, "user-agent": USER_AGENT },
    });
  };
}
