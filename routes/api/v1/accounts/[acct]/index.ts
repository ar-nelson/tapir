import { Handlers } from "$fresh/server.ts";
import { HandlerState } from "$/controllers/MastodonApiController.ts";
import { jsonOr404 } from "$/lib/utils.ts";

export const handler: Handlers<void, HandlerState> = {
  async GET(_req, ctx) {
    return jsonOr404(await ctx.state.controller.account(ctx.params.acct));
  },
};
