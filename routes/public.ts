import { LocalMediaController } from "$/controllers/LocalMediaController.ts";
import { PublicFrontendController } from "$/controllers/PublicFrontendController.ts";
import { Status } from "$/deps.ts";
import { Injectable } from "$/lib/inject.ts";
import {
  activityPubActivity,
  activityPubActor,
  contentTypeIsJson,
  urlJoin,
} from "$/lib/urls.ts";
import { I18nService } from "$/services/I18nService.ts";
import { ViewRouter } from "$/services/ViewRouter.ts";

import { PublicFeedPage } from "$/views/pages/pub/Feed.tsx";
import { NotFoundPage } from "$/views/pages/pub/NotFound.tsx";
import { PublicProfilePage } from "$/views/pages/pub/Profile.tsx";

@Injectable()
export class PublicRouter extends ViewRouter {
  constructor(
    controller: PublicFrontendController,
    i18n: I18nService,
    localMediaController: LocalMediaController,
  ) {
    super(i18n);

    this.get(
      "/",
      (ctx) => ctx.response.redirect(urlJoin(`${ctx.request.url}`, "feed")),
    );
    this.getView(
      "/feed",
      async () =>
        PublicFeedPage({
          ...await controller.instanceFeed(),
          title: (await i18n.state).strings.localTimeline,
        }),
    );

    this.get("/feed/:persona", async (ctx, next) => {
      if (ctx.request.accepts()?.some(contentTypeIsJson)) {
        ctx.response.redirect(activityPubActor(ctx.params.persona));
      } else {
        await next();
      }
    });
    this.getView("/feed/:persona", async (ctx) => {
      const params = await controller.personaFeed(ctx.params.persona);
      return params && PublicProfilePage(params);
    });

    this.get("/post/:id", async (ctx, next) => {
      if (ctx.request.accepts()?.some(contentTypeIsJson)) {
        ctx.response.redirect(activityPubActivity(ctx.params.id));
      } else {
        await next();
      }
    });
    this.getView("/post/:id", async (ctx) => {
      const params = await controller.post(ctx.params.id);
      return params && PublicFeedPage(params);
    });

    this.get(
      "/media/:hash",
      (ctx) => localMediaController.getMedia(ctx, ctx.params.hash),
    );

    this.getView("/(.*)", async (ctx) => {
      ctx.response.status = Status.NotFound;
      return NotFoundPage({ server: await controller.serverDetail() });
    });
  }
}
