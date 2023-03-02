import { Handlers } from "$fresh/server.ts";
import { Injector } from "$/lib/inject.ts";
import { LocalMediaController } from "$/controllers/LocalMediaController.ts";

export const handler: Handlers<void, { injector: Injector }> = {
  async GET(_req, ctx) {
    const controller = await ctx.state.injector.resolve(LocalMediaController);
    return controller.getMedia(ctx.params.file);
  },
};
