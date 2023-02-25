import { InjectableAbstract, Singleton } from "$/lib/inject.ts";

export const USER_AGENT = "just a friendly tapir; https://tapir.social";

@InjectableAbstract()
export abstract class HttpClientService {
  abstract fetch(request: Request): Promise<Response>;
}

@Singleton(HttpClientService)
export class HttpClientServiceImpl extends HttpClientService {
  fetch(request: Request) {
    request.headers.set("user-agent", USER_AGENT);
    return fetch(request);
  }
}
