import { MiddlewareHandlerContext } from "$fresh/server.ts";
import { contentTypeIsJson } from "$/lib/urls.ts";
import { CONTENT_TYPE } from "$/schemas/activitypub/mod.ts";
import defaultContext from "$/schemas/activitypub/defaultContext.json" assert {
  type: "json",
};

export async function handler(
  req: Request,
  ctx: MiddlewareHandlerContext,
) {
  // if (!contentTypeIsJson(req.headers.get("accept") || "")) {
  //   return Response.json({
  //     error:
  //       `Requests to ActivityPub endpoints must include the HTTP header Accept: ${contentType}`,
  //   }, { status: 406 });
  // }
  const rsp = await ctx.next();
  if (
    rsp.status === 404 &&
    !contentTypeIsJson(rsp.headers.get("content-type") ?? "")
  ) {
    return Response.json({ error: "Not Found" }, { status: 404 });
  }
  if (
    contentTypeIsJson(rsp.headers.get("content-type") || "") &&
    rsp.status === 200
  ) {
    return Response.json(
      {
        "@context": defaultContext,
        ...await rsp.json(),
      },
      {
        headers: {
          ...rsp.headers,
          "content-type": CONTENT_TYPE,
        },
      },
    );
  }
  return rsp;
}
