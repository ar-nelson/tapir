import { Handlers } from "$fresh/server.ts";
import { Injector } from "$/lib/inject.ts";
import { InFollowStore } from "$/models/InFollow.ts";
import { ServerConfigStore } from "$/models/ServerConfig.ts";
import * as urls from "$/lib/urls.ts";

export const handler: Handlers<void, { injector: Injector }> = {
  async POST(req, ctx) {
    const { url } = await (await ctx.state.injector.resolve(ServerConfigStore))
        .getServerConfig(),
      inFollowStore = await ctx.state.injector.resolve(InFollowStore);
    await inFollowStore.accept({
      id: (await req.formData()).get("id")!.toString(),
    });
    return Response.redirect(urls.urlJoin(url, "/admin/followers"));
  },
};
