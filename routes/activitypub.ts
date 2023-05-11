import { ActivityPubController } from "$/controllers/ActivityPubController.ts";
import { Context, Router, Status } from "$/deps.ts";
import { Injectable } from "$/lib/inject.ts";
import { CONTENT_TYPE, defaultContextJson } from "$/schemas/activitypub/mod.ts";
import { RouterState } from "./main.ts";

@Injectable()
export class ActivityPubRouter extends Router {
  constructor(controller: ActivityPubController) {
    super();

    this.get("/context", (ctx) => {
      ctx.response.type = "json";
      ctx.response.headers.set("content-type", "application/ld+json");
      ctx.response.body = defaultContextJson;
    })
      .use("/", (ctx, next) => this.#middleware(ctx, next))
      .get(
        "/activity/:id",
        (ctx) => controller.getActivity(ctx.params.id),
      ).get(
        "/object/:id",
        (ctx) => controller.getObject(ctx.params.id),
      ).get(
        "/actor/:name",
        (ctx) => controller.getPersona(ctx.params.name),
      ).get(
        "/actor/:name/followers",
        (ctx) => controller.getFollowers(ctx.params.name),
      ).get(
        "/actor/:name/following",
        (ctx) => controller.getFollowing(ctx.params.name),
      ).get(
        "/actor/:name/outbox",
        (ctx) => controller.getPostCollection(ctx.params.name),
      )
      .post("/actor/:name/inbox", async (ctx) => {
        const json = await ctx.request.body({ type: "json" }).value;
        await controller.onInboxPost(json, ctx.params.name);
        ctx.response.status = 202;
      })
      .get("/(.*)", (ctx) => {
        ctx.response.status = Status.NotFound;
        ctx.response.body = {
          error: "Endpoint does not exist or is not yet implemented",
        };
      });
  }

  async #middleware(ctx: Context<RouterState>, next: () => Promise<unknown>) {
    ctx.state.isJson = true;
    ctx.response.type = "json";
    await next();
    if (
      ctx.response.status === Status.OK && ctx.response.body &&
      typeof ctx.response.body === "object"
    ) {
      ctx.response.body = {
        "@context": defaultContextJson["@context"],
        ...ctx.response.body,
      };
    }
    ctx.response.headers.set("content-type", CONTENT_TYPE);
  }
}
