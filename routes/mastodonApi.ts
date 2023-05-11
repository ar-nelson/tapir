import { MastodonApiController } from "$/controllers/MastodonApiController.ts";
import { Context, Router, Status } from "$/deps.ts";
import { Injectable } from "$/lib/inject.ts";
import { RouterState } from "./main.ts";

@Injectable()
export class MastodonApiRouter extends Router {
  constructor(private readonly controller: MastodonApiController) {
    super();

    this.use("/", this.#middleware.bind(this))
      .get(
        "/instance",
        async (ctx) => ctx.response.body = await controller.instance(),
      )
      .get(
        "/timelines/public",
        async (ctx) => ctx.response.body = await controller.publicTimeline({}),
      )
      .get("/accounts/lookup", (ctx) => this.#lookupAccount(ctx))
      .get(
        "/accounts/:name",
        (ctx) => controller.account(ctx.params.name),
      )
      .get(
        "/accounts/:name/statuses",
        async (ctx) =>
          ctx.response.body = await controller.accountStatuses(
            ctx.params.name,
            {},
          ),
      )
      .get(
        "/statuses/:id",
        (ctx) => controller.status(ctx.params.id),
      )
      .get("/(.*)", (ctx) => {
        ctx.response.status = Status.NotFound;
        ctx.response.body = {
          error: "Endpoint does not exist or is not yet implemented",
        };
      });
  }

  #lookupAccount(ctx: Context) {
    const acct = ctx.request.url.searchParams.get("acct");
    ctx.assert(
      acct != null,
      Status.BadRequest,
      "Query parameter 'acct' is required",
    );
    return this.controller.account(acct);
  }

  async #middleware(ctx: Context<RouterState>, next: () => Promise<unknown>) {
    ctx.state.isJson = true;
    ctx.response.type = "json";
    await next();
  }
}
