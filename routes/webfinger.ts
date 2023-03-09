import { Context, Router, Status } from "$/deps.ts";
import { Injectable } from "$/lib/inject.ts";
import { WebFingerController } from "$/controllers/WebFingerController.ts";
import * as urls from "$/lib/urls.ts";
import { jsonOr404 } from "$/lib/utils.ts";

@Injectable()
export class WebFingerRouter extends Router {
  constructor(controller: WebFingerController) {
    super();

    this.get(
      urls.webfinger,
      (ctx: Context) => {
        const resource = ctx.request.url.searchParams.get("resource");
        ctx.assert(resource != null, Status.BadRequest, "No resource given");
        jsonOr404(ctx, controller.queryResource(resource));
      },
    );
  }
}
