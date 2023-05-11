import { WebFingerController } from "$/controllers/WebFingerController.ts";
import { Context, Router, Status } from "$/deps.ts";
import { Injectable } from "$/lib/inject.ts";
import * as urls from "$/lib/urls.ts";
import { RouterState } from "./main.ts";

@Injectable()
export class WebFingerRouter extends Router {
  constructor(controller: WebFingerController) {
    super();

    this.get(
      urls.webfinger,
      async (ctx: Context<RouterState>) => {
        ctx.state.isJson = true;
        const resource = ctx.request.url.searchParams.get("resource");
        ctx.assert(resource != null, Status.BadRequest, "No resource given");
        ctx.response.body = await controller.queryResource(resource);
      },
    );
  }
}
