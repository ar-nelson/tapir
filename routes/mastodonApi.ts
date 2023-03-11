import { Context, isHttpError, log, Router, Status } from "$/deps.ts";
import { Injectable } from "$/lib/inject.ts";
import { jsonOr404 } from "$/lib/utils.ts";
import { MastodonApiController } from "$/controllers/MastodonApiController.ts";

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
        async (ctx) =>
          jsonOr404(ctx, await controller.account(ctx.params.name)),
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
        async (ctx) => jsonOr404(ctx, await controller.status(ctx.params.id)),
      )
      .get("/(.*)", (ctx) => {
        ctx.response.status = Status.NotFound;
        ctx.response.body = {
          error: "Endpoint does not exist or is not yet implemented",
        };
      });
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

  async #middleware(ctx: Context, next: () => Promise<unknown>) {
    ctx.response.type = "json";
    try {
      await next();
    } catch (err) {
      log.error(`Error occurred at URL ${ctx.request.url}:`);
      log.error(err);
      if (isHttpError(err)) {
        ctx.response.status = err.status;
      } else {
        ctx.response.status = Status.InternalServerError;
      }
      ctx.response.body = { error: `${err.message ?? err}` };
    }
  }
}
