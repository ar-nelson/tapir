import { Tag } from "$/lib/error.ts";
import { InjectableAbstract, Singleton } from "$/lib/inject.ts";

export const USER_AGENT = "just a friendly tapir; https://tapir.social";

export const ResponseTooLarge = new Tag("Response Too Large", {
  needsStackTrace: false,
});

@InjectableAbstract()
export abstract class HttpClientService {
  abstract fetch(
    request: Request,
    opts?: { signal?: AbortSignal; maxBytes?: number },
  ): Promise<Response>;
}

@Singleton(HttpClientService)
export class HttpClientServiceImpl extends HttpClientService {
  async fetch(
    request: Request,
    { signal, maxBytes }: { signal?: AbortSignal; maxBytes?: number } = {},
  ) {
    request.headers.set("user-agent", USER_AGENT);
    const rsp = await fetch(request, { signal });
    if (maxBytes) {
      const contentLength = rsp.headers.get("content-length");
      if (contentLength == null) {
        throw ResponseTooLarge.error(
          "Response must have a Content-Length header",
        );
      }
      if (+contentLength > maxBytes) {
        throw ResponseTooLarge.error(
          `Response is larger than limit of ${maxBytes} bytes`,
        );
      }
    }
    return rsp;
  }
}
