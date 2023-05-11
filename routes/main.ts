import { PublicFrontendController } from "$/controllers/PublicFrontendController.ts";
import { Context, isHttpError, Status } from "$/deps.ts";
import { logError, Tag } from "$/lib/error.ts";
import { Injectable } from "$/lib/inject.ts";
import { I18nService } from "$/services/I18nService.ts";
import { ViewRouter } from "$/services/ViewRouter.ts";

import { IndexPage } from "$/views/pages/pub/Index.tsx";
import { NotFoundPage } from "$/views/pages/pub/NotFound.tsx";
import { ServerErrorPage } from "$/views/pages/pub/ServerError.tsx";

import { ActivityPubRouter } from "$/routes/activitypub.ts";
import { LegacyRedirectsRouter } from "$/routes/legacyRedirects.ts";
import { MastodonApiRouter } from "$/routes/mastodonApi.ts";
import { NodeInfoRouter } from "$/routes/nodeinfo.ts";
import { PrivateRouter } from "$/routes/private.ts";
import { PublicRouter } from "$/routes/public.ts";
import { WebFingerRouter } from "$/routes/webfinger.ts";

export interface RouterState {
  isJson?: boolean;
  isAuthenticated?: boolean;
}

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

  async #errorPageMiddleware(
    ctx: Context<RouterState>,
    next: () => Promise<unknown>,
  ) {
    try {
      await next();
    } catch (err) {
      logError(`Error occurred at URL ${ctx.request.url}`, err);
      let errorType: string | undefined, errorMessage: string | undefined;
      if (Tag.is(err)) {
        ctx.response.status = err.tag.httpStatus;
        if (ctx.state.isAuthenticated || !err.tag.internal) {
          errorType = err.tag.name;
          errorMessage = err.message;
        }
      } else if (isHttpError(err)) {
        ctx.response.status = err.status;
      } else {
        ctx.response.status = Status.InternalServerError;
        if (ctx.state.isAuthenticated && err instanceof Error) {
          errorType = err.constructor.name, errorMessage = err.message;
        }
      }
      if (ctx.state.isJson) {
        ctx.response.type = "json";
        ctx.response.body = {
          error: errorMessage ??
            (ctx.response.status === Status.NotFound
              ? "Not found"
              : "Internal error"),
          errorType,
        };
      } else {
        ctx.response.type = "html";
        const view = ctx.response.status === Status.NotFound
          ? NotFoundPage({ server: await this.controller.serverDetail() })
          : ServerErrorPage({
            server: await this.controller.serverDetail(),
            status: ctx.response.status,
            errorType,
            errorMessage,
          });
        ctx.response.body = view.render(await this.i18n.state);
      }
    }
  }
}
