import { Handlers } from "$fresh/server.ts";
import { Injector } from "$/lib/inject.ts";
import { MastodonApiService } from "$/services/MastodonApiService.ts";

export const handler: Handlers<void, { injector: Injector }> = {
  async GET(_req, ctx) {
    const service = ctx.state.injector.resolve(MastodonApiService),
      statuses = await service.accountStatuses(ctx.params.acct, {});
    if (statuses == null) {
      return Response.json({ error: "Record not found" }, { status: 404 });
    }
    return Response.json(statuses);
  },
};
