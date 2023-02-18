import { Handlers } from "$fresh/server.ts";
import { Injector } from "$/lib/inject.ts";
import { ActivityPubService } from "$/services/ActivityPubService.ts";

export const handler: Handlers<void, { injector: Injector }> = {
  async GET(_req, ctx) {
    const service = await ctx.state.injector.resolve(ActivityPubService),
      posts = await service.getPostCollection(ctx.params.name);
    if (!posts) {
      return Response.json({ error: "Record not found" }, { status: 404 });
    }
    return Response.json(posts);
  },
};
