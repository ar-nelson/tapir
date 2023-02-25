import { Handlers } from "$fresh/server.ts";
import { HandlerState } from "$/controllers/MastodonApiController.ts";
import { jsonOr404 } from "$/lib/utils.ts";

export const handler: Handlers<void, HandlerState> = {
  async GET(req, ctx) {
    const acct = new URL(req.url).searchParams.get("acct");
    if (acct == null) {
      return Response.json({ error: "No acct parameter given" }, {
        status: 400,
      });
    }
    return jsonOr404(await ctx.state.controller.account(acct));
  },
};
