import { Injectable } from "$/lib/inject.ts";
import { urlJoin } from "$/lib/urls.ts";
import { I18nService } from "$/services/I18nService.ts";
import { ViewRouter } from "$/services/ViewRouter.ts";
import { PublicFrontendController } from "$/controllers/PublicFrontendController.ts";
import { LocalMediaController } from "$/controllers/LocalMediaController.ts";

import { PublicFeedPage } from "$/views/pages/pub/Feed.tsx";
import { PublicProfilePage } from "$/views/pages/pub/Profile.tsx";

@Injectable()
export class PublicRouter extends ViewRouter {
  constructor(
    controller: PublicFrontendController,
    localMediaController: LocalMediaController,
    i18n: I18nService,
  ) {
    super(i18n);

    this.get(
      "/",
      (ctx) => ctx.response.redirect(urlJoin(`${ctx.request.url}`, "/feed")),
    );
    this.getView(
      "/feed",
      async () =>
        PublicFeedPage({
          ...await controller.instanceFeed(),
          title: (await i18n.state).strings.localTimeline,
        }),
    );
    this.getView("/feed/:persona", async (ctx) => {
      const params = await controller.personaFeed(ctx.params.persona);
      return params && PublicProfilePage(params);
    });
    this.getView("/post/:id", async (ctx) => {
      const params = await controller.post(ctx.params.id);
      return params && PublicFeedPage(params);
    });
    this.get(
      "/media/:hash",
      (ctx) => localMediaController.getMedia(ctx, ctx.params.hash),
    );
  }
}
