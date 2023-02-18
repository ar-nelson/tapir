import { Handlers } from "$fresh/server.ts";
import { Injector } from "$/lib/inject.ts";
import { MastodonApiService } from "$/services/MastodonApiService.ts";

export const handler: Handlers<void, { injector: Injector }> = {
  async GET(req, ctx) {
    const url = new URL(req.url),
      service = await ctx.state.injector.resolve(MastodonApiService),
      acct = url.searchParams.get("acct");
    if (acct == null) {
      return Response.json({ error: "No acct parameter given" }, {
        status: 400,
      });
    }
    const account = await service.account(acct);
    if (!account) {
      return Response.json({ error: "Record not found" }, { status: 404 });
    }
    return Response.json(account);
  },
};
