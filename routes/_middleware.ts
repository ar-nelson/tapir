import { MiddlewareHandlerContext } from "$fresh/server.ts";
import { Injector } from "$/lib/inject.ts";
import { contentTypeIsJson } from "$/lib/urls.ts";
import { LocalDatabaseService } from "$/services/LocalDatabaseService.ts";
import { LocalDatabaseSpec } from "$/schemas/tapir/LocalDatabase.ts";
import { DBSelector } from "$/lib/db/DBSelector.ts";
import { log } from "$/deps.ts";

interface State {
  injector: Injector;
}

const globalInjector = new Injector(
  [LocalDatabaseService, DBSelector(LocalDatabaseSpec, "local.db")],
);

export async function handler(
  req: Request,
  ctx: MiddlewareHandlerContext<State>,
) {
  ctx.state.injector = globalInjector;
  const method = req.method, userAgent = req.headers.get("user-agent");
  let rsp = await ctx.next();
  if (method === "OPTIONS" && rsp.status === 405) {
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
  if (rsp.status < 300 || rsp.status >= 400) {
    rsp.headers.append("Access-Control-Allow-Origin", "*");
    rsp.headers.append(
      "Access-Control-Allow-Methods",
      "POST, PUT, DELETE, GET, PATCH, OPTIONS",
    );
    rsp.headers.append("Access-Control-Allow-Headers", "*");
    rsp.headers.append("Access-Control-Max-Age", "86400");

    const path = new URL(req.url).pathname;
    if (rsp.status >= 400) {
      log.warning(`${method} ${path}: ${rsp.status} (${userAgent})`);
    } else {
      log.info(`${method} ${path}: ${rsp.status} (${userAgent})`);
    }
  }

  return rsp;
}
