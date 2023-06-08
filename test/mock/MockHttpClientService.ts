import { Request as OakRequest, Router, testing } from "$/deps.ts";
import { Singleton } from "$/lib/inject.ts";
import { HttpClientService } from "$/services/HttpClientService.ts";
import { RequestBody } from "oak/body.ts";

@Singleton()
export class MockHttpClientService extends HttpClientService {
  #routers = new Map<string, Router>();

  constructor() {
    super();
  }

  route(host: string, router: Router): void {
    this.#routers.set(host, router);
  }

  async fetch(req: Request) {
    const url = new URL(req.url),
      router = this.#routers.get(url.host);
    if (router == null) {
      throw new Error(`No router registered for mock URL host ${url.host}`);
    }
    const ctx = testing.createMockContext({
        method: req.method,
        headers: [...req.headers.entries()],
        path: url.pathname + url.search,
      }),
      next = testing.createMockNext();

    if ((req.method === "POST" || req.method === "PUT") && req.body) {
      const body = new RequestBody({
        body: req.body,
        readBody: () => req.arrayBuffer().then((b) => new Uint8Array(b)),
      }, req.headers);
      ctx.request.body = body.get.bind(body) as OakRequest["body"];
    }

    await router.routes()(ctx, next);
    return ctx.response.toDomResponse();
  }
}
