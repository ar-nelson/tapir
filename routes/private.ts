import { Request, Status } from "$/deps.ts";
import { Injectable } from "$/lib/inject.ts";
import { urlJoin } from "$/lib/urls.ts";
import { I18nService } from "$/services/I18nService.ts";
import { ViewRouter } from "$/services/ViewRouter.ts";
import { InstanceConfigStore } from "$/models/InstanceConfig.ts";
import { SettingsRouter } from "$/routes/settings.ts";

@Injectable()
export class PrivateRouter extends ViewRouter {
  constructor(
    instanceConfigStore: InstanceConfigStore,
    settingsRouter: SettingsRouter,
    i18n: I18nService,
  ) {
    super(i18n);

    this.use(async (ctx, next) => {
      if (await this.#validateAuth(ctx.request, instanceConfigStore)) {
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

  async #validateAuth(
    req: Request,
    configStore: InstanceConfigStore,
  ): Promise<boolean> {
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
      pass = userpass.slice(split + 1);
    return user === (await configStore.get()).loginName &&
      await configStore.checkPassword(pass);
  }
}
