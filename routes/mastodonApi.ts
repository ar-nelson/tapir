import { Context, Router, Status } from "$/deps.ts";
import { Injectable } from "$/lib/inject.ts";
import { jsonOr404 } from "$/lib/utils.ts";
import { MastodonApiController } from "$/controllers/MastodonApiController.ts";

@Injectable()
export class MastodonApiRouter extends Router {
  constructor(private readonly controller: MastodonApiController) {
    super();

    this.get(
      "/instance",
      async (ctx) => ctx.response.body = await controller.instance(),
    )
      .get(
        "/timelines/public",
        async (ctx) => ctx.response.body = await controller.publicTimeline({}),
      ).get("/accounts/lookup", (ctx) => this.#lookupAccount(ctx)).get(
        "/accounts/:name",
        async (ctx) =>
          jsonOr404(ctx, await controller.account(ctx.params.name)),
      ).get(
        "/accounts/:name/statuses",
        async (ctx) =>
          ctx.response.body = await controller.accountStatuses(
            ctx.params.name,
            {},
          ),
      ).get(
        "/statuses/:id",
        async (ctx) => jsonOr404(ctx, await controller.status(ctx.params.id)),
      );
  }

  async #lookupAccount(ctx: Context) {
    const acct = ctx.request.url.searchParams.get("acct");
    ctx.assert(
      acct != null,
      Status.BadRequest,
      "Query parameter 'acct' is required",
    );
    jsonOr404(ctx, await this.controller.account(acct));
  }
}
