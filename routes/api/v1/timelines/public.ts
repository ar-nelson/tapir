import { Handlers } from "$fresh/server.ts";
import { Injector } from "$/lib/inject.ts";
import { MastodonApiService } from "$/services/MastodonApiService.ts";

export const handler: Handlers<void, { injector: Injector }> = {
  async GET(_req, ctx) {
    const service = await ctx.state.injector.resolve(MastodonApiService);
    return Response.json(await service.publicTimeline({}));
  },
};
