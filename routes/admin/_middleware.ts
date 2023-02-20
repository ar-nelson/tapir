import { MiddlewareHandlerContext } from "$fresh/server.ts";
import { Injector } from "$/lib/inject.ts";
import { binaryEqual, hashPassword } from "$/lib/utils.ts";
import { ServerConfig, ServerConfigStore } from "$/models/ServerConfig.ts";

function validateAuth(req: Request, config: ServerConfig): boolean {
  const auth = req.headers.get("Authorization") ?? "",
    match = /^Basic ([a-z0-9\/+=]+)$/i.exec(auth);
  if (!match) {
    return false;
  }
  const userpass = atob(match[1]),
    split = userpass.indexOf(":");
  if (split <= 0) {
    return false;
  }
  const user = userpass.slice(0, split),
    pass = userpass.slice(split + 1),
    hash = hashPassword(pass, config.passwordSalt);
  return user === config.loginName && binaryEqual(hash, config.passwordHash);
}

export async function handler(
  req: Request,
  ctx: MiddlewareHandlerContext<{ injector: Injector }>,
) {
  const serverConfigStore = await ctx.state.injector.resolve(ServerConfigStore),
    serverConfig = await serverConfigStore.getServerConfig();
  if (!validateAuth(req, serverConfig)) {
    return new Response("no", {
      status: 401,
      headers: { "WWW-Authenticate": "Basic realm=tapir" },
    });
  }
  return ctx.next();
}
