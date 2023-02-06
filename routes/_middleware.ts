import { Injector } from "$/lib/inject.ts";
import { MiddlewareHandlerContext } from "$fresh/server.ts";

interface State {
  injector: Injector;
}

const globalInjector = new Injector();

export async function handler(
  req: Request,
  ctx: MiddlewareHandlerContext<State>,
) {
  ctx.state.injector = globalInjector;
  const rsp = await ctx.next();
  if (
    rsp.status === 404 &&
    !/^application\/(?:\w+\+)?json$/.test(
      rsp.headers.get("content-type") ?? "",
    ) &&
    /^application\/(?:\w+\+)?json$/.test(req.headers.get("accept") ?? "")
  ) {
    return new Response('{"error":"Not Found"}}', {
      status: 404,
      headers: {
        "content-type": req.headers.get("accept") ?? "application/json",
      },
    });
  }
  return rsp;
}
