import { Context, Router, RouterContext, Status } from "$/deps.ts";
import { Injectable } from "$/lib/inject.ts";
import { jsonOr404 } from "$/lib/utils.ts";
import { BlockedServerStore } from "$/models/BlockedServer.ts";
import { ActivityPubController } from "$/controllers/ActivityPubController.ts";
import { CONTENT_TYPE, defaultContext } from "$/schemas/activitypub/mod.ts";

@Injectable()
export class ActivityPubRouter extends Router {
  constructor(
    private readonly controller: ActivityPubController,
    private readonly blockedServerStore: BlockedServerStore,
  ) {
    super();

    this.use((ctx, next) => this.#middleware(ctx, next))
      .get(
        "/activity/:id",
        async (ctx) =>
          jsonOr404(ctx, await controller.getActivity(ctx.params.id)),
      ).get(
        "/object/:id",
        async (ctx) =>
          jsonOr404(ctx, await controller.getObject(ctx.params.id)),
      ).get(
        "/actor/:name",
        async (ctx) =>
          jsonOr404(ctx, await controller.getPersona(ctx.params.name)),
      ).get(
        "/actor/:name/followers",
        async (ctx) =>
          jsonOr404(ctx, await controller.getFollowers(ctx.params.name)),
      ).get(
        "/actor/:name/following",
        async (ctx) =>
          jsonOr404(ctx, await controller.getFollowing(ctx.params.name)),
      ).get(
        "/actor/:name/outbox",
        async (ctx) =>
          jsonOr404(ctx, await controller.getPostCollection(ctx.params.name)),
      )
      .post("/actor/:name/inbox", (ctx) => this.#inbox(ctx));
  }

  async #inbox(ctx: RouterContext<"/actor/:name/inbox", { name: string }>) {
    const json = await ctx.request.body({ type: "json" }).value,
      { id, actor } = json,
      idUrl = typeof id === "string" && new URL(id),
      actorUrl = typeof actor === "string" && new URL(actor),
      activity = await this.controller.canonicalizeIncomingActivity(json);

    if (idUrl) {
      ctx.assert(
        !await this.blockedServerStore.blocksActivityUrl(idUrl),
        Status.Forbidden,
        `Rejected ActivityPub POST from blocked domain ${idUrl.hostname}`,
      );
    }
    if (actorUrl) {
      ctx.assert(
        !await this.blockedServerStore.blocksActivityUrl(actorUrl),
        Status.Forbidden,
        `Rejected ActivityPub POST from blocked domain ${actorUrl.hostname}`,
      );
    }

    ctx.assert(
      activity,
      Status.BadRequest,
      "Request body was not a valid Activity",
    );
    await this.controller.onInboxPost(ctx.params.name, activity);
    ctx.response.status = 202;
  }

  async #middleware(ctx: Context, next: () => Promise<unknown>) {
    ctx.response.type = "json";
    await next();
    if (
      ctx.response.status === 200 && ctx.response.body &&
      typeof ctx.response.body === "object"
    ) {
      ctx.response.body = {
        "@context": defaultContext,
        ...ctx.response.body,
      };
      ctx.response.headers.set("content-type", CONTENT_TYPE);
    }
  }
}
