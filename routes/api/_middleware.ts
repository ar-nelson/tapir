import { MiddlewareHandlerContext } from "$fresh/server.ts";

export async function handler(
  _req: Request,
  ctx: MiddlewareHandlerContext,
) {
  const rsp = await ctx.next();
  if (
    rsp.status === 404 && rsp.headers.get("content-type") !== "application/json"
  ) {
    return Response.json({ error: "Not Found" }, { status: 404 });
  }
  return rsp;
}
