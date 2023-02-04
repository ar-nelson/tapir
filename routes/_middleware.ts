import { Injector } from "$/lib/inject.ts";
import { MiddlewareHandlerContext } from "$fresh/server.ts";

interface State {
  injector: Injector;
}

const globalInjector = new Injector();

export function handler(
  _req: Request,
  ctx: MiddlewareHandlerContext<State>,
) {
  ctx.state.injector = globalInjector;
  return ctx.next();
}
