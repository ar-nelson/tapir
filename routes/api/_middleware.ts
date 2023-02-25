import { MiddlewareHandlerContext } from "$fresh/server.ts";
import { contentTypeIsJson } from "$/lib/urls.ts";
import {
  HandlerState,
  MastodonApiController,
} from "$/controllers/MastodonApiController.ts";

export async function handler(
  _req: Request,
  ctx: MiddlewareHandlerContext<HandlerState>,
) {
  ctx.state.controller = await ctx.state.injector.resolve(
    MastodonApiController,
  );
  const rsp = await ctx.next();
  if (
    rsp.status === 404 &&
    !contentTypeIsJson(rsp.headers.get("content-type") ?? "")
  ) {
    return Response.json({ error: "Not Found" }, { status: 404 });
  }
  return rsp;
}
