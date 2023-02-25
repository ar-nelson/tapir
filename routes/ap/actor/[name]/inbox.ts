import { Handlers } from "$fresh/server.ts";
import { HandlerState } from "$/controllers/ActivityPubController.ts";

export const handler: Handlers<void, HandlerState> = {
  async POST(req, ctx) {
    const activity = await ctx.state.controller.canonicalizeIncomingActivity(
      await req.json(),
    );
    if (activity) {
      return ctx.state.controller.onInboxPost(ctx.params.name, activity);
    } else {
      return Response.json({ error: "Request body was not a valid Activity" }, {
        status: 400,
      });
    }
  },
};
