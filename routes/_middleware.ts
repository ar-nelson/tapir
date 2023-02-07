import { MiddlewareHandlerContext } from "$fresh/server.ts";
import { Injector } from "$/lib/inject.ts";
import { contentTypeIsJson } from "$/lib/urls.ts";

interface State {
  injector: Injector;
}

const globalInjector = new Injector();

export async function handler(
  req: Request,
  ctx: MiddlewareHandlerContext<State>,
) {
  ctx.state.injector = globalInjector;
  let rsp = await ctx.next();

  if (req.method === "OPTIONS" && rsp.status === 405) {
    rsp = new Response(null, {
      status: 204,
      headers: {
        Allow: "POST, PUT, DELETE, GET, PATCH, OPTIONS",
      },
    });
  } else if (
    rsp.status === 404 &&
    !contentTypeIsJson(rsp.headers.get("content-type") ?? "") &&
    contentTypeIsJson(req.headers.get("accept") ?? "")
  ) {
    rsp = Response.json({ error: "Not Found" }, { status: 404 });
  }

  // allow everything because CORS sucks
  // TODO: might need to change this someday
  rsp.headers.append("Access-Control-Allow-Origin", "*");
  rsp.headers.append(
    "Access-Control-Allow-Methods",
    "POST, PUT, DELETE, GET, PATCH, OPTIONS",
  );
  rsp.headers.append("Access-Control-Allow-Headers", "*");
  rsp.headers.append("Access-Control-Max-Age", "86400");

  return rsp;
}
