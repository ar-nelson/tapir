import { MiddlewareHandlerContext } from "$fresh/server.ts";
import {
  AbstractConstructor,
  ConditionalResolver,
  Constructor,
  Injectable,
  Injector,
} from "$/lib/inject.ts";
import { contentTypeIsJson } from "$/lib/urls.ts";
import { dirExists } from "$/lib/utils.ts";
import { ServerConfigStore } from "$/models/ServerConfig.ts";
import { LocalDatabaseSpec } from "$/schemas/tapir/LocalDatabase.ts";
import { DatabaseService } from "$/services/DatabaseService.ts";
import { InMemoryDatabaseServiceFactory } from "$/services/InMemoryDatabaseService.ts";
import { SqliteDatabaseServiceFactory } from "$/services/SqliteDatabaseService.ts";
import * as log from "https://deno.land/std@0.176.0/log/mod.ts";
import * as path from "https://deno.land/std@0.176.0/path/mod.ts";

interface State {
  injector: Injector;
}

@Injectable()
class LocalDatabaseSelector
  extends ConditionalResolver<DatabaseService<typeof LocalDatabaseSpec>> {
  constructor(private readonly serverConfigStore: ServerConfigStore) {
    super();
  }

  async resolve() {
    const config = await this.serverConfigStore.getServerConfig();
    if (!await dirExists(config.dataDir)) {
      await Deno.mkdir(config.dataDir, { recursive: true });
    }
    switch (config.localDatabase.type) {
      case "inmemory":
        return new InMemoryDatabaseServiceFactory().init(LocalDatabaseSpec);
      case "sqlite":
        return new SqliteDatabaseServiceFactory(
          path.join(config.dataDir, config.localDatabase.path ?? "local.db"),
        ).init(LocalDatabaseSpec);
    }
  }
}

const globalInjector = new Injector(
  new Map<AbstractConstructor, Constructor>([
    [DatabaseService, LocalDatabaseSelector],
  ]),
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

  return rsp;
}
