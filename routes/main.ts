import { Injectable } from "$/lib/inject.ts";
import { ViewRouter } from "$/services/ViewRouter.ts";
import { I18nService } from "$/services/I18nService.ts";
import { PublicFrontendController } from "$/controllers/PublicFrontendController.ts";

import { IndexPage } from "$/views/pages/pub/Index.tsx";

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
    controller: PublicFrontendController,
    i18n: I18nService,
  ) {
    super(i18n);

    this.use(
      webFingerRouter.routes(),
      nodeInfoRouter.routes(),
      legacyRedirectsRouter.routes(),
    );
    this.use("/app", privateRouter.routes());
    this.use("/pub", publicRouter.routes());
    this.use("/api/v1", mastodonApiRouter.routes());
    this.use("/ap", activityPubRouter.routes());

    // TODO: Remove dependency on static files
    this.get(
      "/static/:file",
      (ctx) => ctx.send({ root: "static", path: ctx.params.file }),
    );

    this.getView(
      "/",
      async () => IndexPage({ server: await controller.serverDetail() }),
    );
  }
}
