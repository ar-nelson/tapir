import { Handlers } from "$fresh/server.ts";
import { HandlerState } from "$/controllers/MastodonApiController.ts";

export const handler: Handlers<void, HandlerState> = {
  async GET(_req, ctx) {
    return Response.json(await ctx.state.controller.publicTimeline({}));
  },
};
