import { Injectable } from "$/lib/inject.ts";
import { Context, isHttpError, log, Status } from "$/deps.ts";
import { ViewRouter } from "$/services/ViewRouter.ts";
import { I18nService } from "$/services/I18nService.ts";
import { PublicFrontendController } from "$/controllers/PublicFrontendController.ts";

import { IndexPage } from "$/views/pages/pub/Index.tsx";
import { NotFoundPage } from "$/views/pages/pub/NotFound.tsx";
import { ServerErrorPage } from "$/views/pages/pub/ServerError.tsx";

import { PublicRouter } from "$/routes/public.ts";
import { PrivateRouter } from "$/routes/private.ts";
import { MastodonApiRouter } from "$/routes/mastodonApi.ts";
import { ActivityPubRouter } from "$/routes/activitypub.ts";
import { NodeInfoRouter } from "$/routes/nodeinfo.ts";
import { WebFingerRouter } from "$/routes/webfinger.ts";
import { LegacyRedirectsRouter } from "$/routes/legacyRedirects.ts";

@Injectable()
export class TapirRouter extends ViewRouter {
  constructor(
    publicRouter: PublicRouter,
    privateRouter: PrivateRouter,
    mastodonApiRouter: MastodonApiRouter,
    activityPubRouter: ActivityPubRouter,
    nodeInfoRouter: NodeInfoRouter,
    webFingerRouter: WebFingerRouter,
    legacyRedirectsRouter: LegacyRedirectsRouter,
    private readonly controller: PublicFrontendController,
    private readonly i18n: I18nService,
  ) {
    super(i18n);

    this.use(this.#errorPageMiddleware.bind(this));

    this.getView(
      "/",
      async () => IndexPage({ server: await controller.serverDetail() }),
    );

    this.use(
      webFingerRouter.routes(),
      webFingerRouter.allowedMethods(),
      nodeInfoRouter.routes(),
      nodeInfoRouter.allowedMethods(),
      legacyRedirectsRouter.routes(),
      legacyRedirectsRouter.allowedMethods(),
    );
    this.use("/app", privateRouter.routes(), privateRouter.allowedMethods());
    this.use("/pub", publicRouter.routes(), publicRouter.allowedMethods());
    this.use(
      "/api/v1",
      mastodonApiRouter.routes(),
      mastodonApiRouter.allowedMethods(),
    );
    this.use(
      "/ap",
      activityPubRouter.routes(),
      activityPubRouter.allowedMethods(),
    );

    // TODO: Remove dependency on static files
    this.get(
      "/static/:file",
      (ctx) => ctx.send({ root: "static", path: ctx.params.file }),
    );

    this.getView("/(.*)", async (ctx) => {
      ctx.response.status = Status.NotFound;
      return NotFoundPage({ server: await controller.serverDetail() });
    });
  }

  async #errorPageMiddleware(ctx: Context, next: () => Promise<unknown>) {
    try {
      await next();
    } catch (err) {
      log.error(`Error occurred at URL ${ctx.request.url}:`);
      log.error(err);
      if (isHttpError(err)) {
        ctx.response.status = err.status;
      } else {
        ctx.response.status = Status.InternalServerError;
      }
      const view = ctx.response.status === Status.NotFound
        ? NotFoundPage
        : ServerErrorPage;
      ctx.response.type = "html";
      ctx.response.body = view({ server: await this.controller.serverDetail() })
        .render(await this.i18n.state);
    }
  }
}
