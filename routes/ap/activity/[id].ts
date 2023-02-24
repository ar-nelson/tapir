import { Handlers } from "$fresh/server.ts";
import { Injector } from "$/lib/inject.ts";
import { LocalActivityStore } from "$/models/LocalActivity.ts";

export const handler: Handlers<void, { injector: Injector }> = {
  async GET(_req, ctx) {
    const service = await ctx.state.injector.resolve(LocalActivityStore),
      object = await service.get(ctx.params.id);
    if (!object) {
      return Response.json({ error: "Record not found" }, { status: 404 });
    }
    return Response.json(object);
  },
};
