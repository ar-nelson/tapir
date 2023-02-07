import { Handlers } from "$fresh/server.ts";
import { Injector } from "$/lib/inject.ts";
import { ActivityPubService } from "$/services/ActivityPubService.ts";

export const handler: Handlers<void, { injector: Injector }> = {
  async GET(_req, ctx) {
    const service = ctx.state.injector.resolve(ActivityPubService),
      post = await service.getPost(ctx.params.name, ctx.params.id);
    if (!post) {
      return Response.json({ error: "Record not found" }, { status: 404 });
    }
    return Response.json(post);
  },
};
