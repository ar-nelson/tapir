import { Request, Status } from "$/deps.ts";
import { Injectable } from "$/lib/inject.ts";
import { urlJoin } from "$/lib/urls.ts";
import { binaryEqual, hashPassword } from "$/lib/utils.ts";
import { I18nService } from "$/services/I18nService.ts";
import { ViewRouter } from "$/services/ViewRouter.ts";
import { ServerConfig, ServerConfigStore } from "$/models/ServerConfig.ts";
import { SettingsRouter } from "$/routes/settings.ts";

@Injectable()
export class PrivateRouter extends ViewRouter {
  constructor(
    serverConfigStore: ServerConfigStore,
    settingsRouter: SettingsRouter,
    i18n: I18nService,
  ) {
    super(i18n);

    this.use(async (ctx, next) => {
      const serverConfig = await serverConfigStore.getServerConfig();
      if (this.#validateAuth(ctx.request, serverConfig)) {
        await next();
      } else {
        ctx.response.headers.set("WWW-Authenticate", "Basic realm=tapir");
        ctx.response.status = Status.Unauthorized;
        ctx.response.body = "no";
      }
    });

    this.get(
      "/",
      (ctx) => ctx.response.redirect(urlJoin(`${ctx.request.url}`, "settings")),
    );
    this.use("/settings", settingsRouter.routes());
  }

  #validateAuth(req: Request, config: ServerConfig): boolean {
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
}
