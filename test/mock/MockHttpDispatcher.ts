import { Router } from "$/deps.ts";
import { HttpDispatcher } from "$/services/HttpDispatcher.ts";
import { MockHttpClientService } from "$/test/mock/MockHttpClientService.ts";

export class MockHttpDispatcher extends HttpDispatcher {
  #client = new MockHttpClientService();

  constructor() {
    super();
  }

  route(host: string, router: Router): void {
    this.#client.route(host, router);
  }

  dispatch(request: Request) {
    return {
      cancel: () => {},
      response: this.#client.fetch(request),
      dispatched: Promise.resolve(),
    };
  }

  dispatchInOrder(requests: Request[]) {
    const first = this.dispatch(requests[0]),
      dispatches = [first],
      dispatch = this.dispatch.bind(this),
      dispatched = (async () => {
        await first.dispatched;
        for (const req of requests.slice(1)) {
          const next = dispatch(req);
          dispatches.push(next);
          await next.dispatched;
        }
      })();
    return {
      cancel: () => dispatches.forEach((d) => d.cancel()),
      dispatched,
      responses: (async function* () {
        await dispatched;
        for (const { response } of dispatches) {
          yield await response;
        }
      })(),
    };
  }

  cancelAllForHost() {/* does nothing */}
}
