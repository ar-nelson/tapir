import { RemoteMediaController } from "$/controllers/RemoteMediaController.ts";
import { Context, Request, Status } from "$/deps.ts";
import { Injectable } from "$/lib/inject.ts";
import { urlJoin } from "$/lib/urls.ts";
import { InstanceConfigStore } from "$/models/InstanceConfig.ts";
import { Protocol } from "$/models/types.ts";
import { SettingsRouter } from "$/routes/settings.ts";
import { I18nService } from "$/services/I18nService.ts";
import { ViewRouter } from "$/services/ViewRouter.ts";
import { RouterState } from "./main.ts";

@Injectable()
export class PrivateRouter extends ViewRouter {
  constructor(
    instanceConfigStore: InstanceConfigStore,
    remoteMediaController: RemoteMediaController,
    settingsRouter: SettingsRouter,
    i18n: I18nService,
  ) {
    super(i18n);

    this.use(async (ctx: Context<RouterState>, next) => {
      if (await this.#validateAuth(ctx.request, instanceConfigStore)) {
        ctx.state.isAuthenticated = true;
        await next();
      } else {
        ctx.response.headers.set("WWW-Authenticate", "Basic realm=tapir");
        ctx.response.status = Status.Unauthorized;
        ctx.response.body = "no";
      }
    });

    function streamParams(ctx: Context<RouterState>) {
      const p = ctx.request.url.searchParams.get("p"),
        u = ctx.request.url.searchParams.get("u"),
        page = ctx.request.url.searchParams.get("page");
      ctx.assert(
        p && u,
        Status.BadRequest,
        'Missing query parameters "p" and/or "u"',
      );
      return { addr: { protocol: p as Protocol, path: u }, page };
    }

    this.get(
      "/",
      (ctx) => ctx.response.redirect(urlJoin(`${ctx.request.url}`, "settings")),
    );
    this.use("/settings", settingsRouter.routes());

    this.get("/instance", async (ctx: Context<RouterState>) => {
    });
    this.get("/instance/users", async (ctx: Context<RouterState>) => {
    });
    this.get("/feed", async (ctx: Context<RouterState>) => {
      const { addr, page } = streamParams(ctx);
    });
    this.get("/profile", async (ctx: Context<RouterState>) => {
      const { addr, page } = streamParams(ctx);
    });
    this.get("/profile/followers", async (ctx: Context<RouterState>) => {
      const { addr, page } = streamParams(ctx);
    });
    this.get("/profile/following", async (ctx: Context<RouterState>) => {
      const { addr, page } = streamParams(ctx);
    });
    this.get("/post", async (ctx: Context<RouterState>) => {
      const { addr, page } = streamParams(ctx);
    });
    this.get("/post/boosts", async (ctx: Context<RouterState>) => {
      const { addr, page } = streamParams(ctx);
    });
    this.get("/post/reactions", async (ctx: Context<RouterState>) => {
      const { addr, page } = streamParams(ctx);
    });

    this.get(
      "/media/preload",
      async (ctx: Context<RouterState>) => {
        const url = ctx.request.url.searchParams.get("url");
        ctx.assert(
          url != null,
          Status.BadRequest,
          'Missing query parameter "url"',
        );
        await remoteMediaController.preload(ctx, url);
      },
    );
    this.get(
      "/media/:hash",
      (ctx) => remoteMediaController.getMedia(ctx, ctx.params.hash),
    );
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
