import { Handlers } from "$fresh/server.ts";
import { Injector } from "$/lib/inject.ts";
import { ServerConfigStore } from "$/models/ServerConfig.ts";
import * as urls from "$/lib/urls.ts";

export const handler: Handlers<void, { injector: Injector }> = {
  async GET(_req, ctx) {
    const serverConfigStore = await ctx.state.injector.resolve(
        ServerConfigStore,
      ),
      serverConfig = await serverConfigStore.getServerConfig();

    return Response.redirect(
      urls.activityPubOutbox(ctx.params.name, serverConfig.url),
      301,
    );
  },
};
