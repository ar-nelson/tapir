import { MiddlewareHandlerContext } from "$fresh/server.ts";
import { Injector } from "$/lib/inject.ts";
import { contentTypeIsJson } from "$/lib/urls.ts";
import { JsonLdService } from "$/services/JsonLdService.ts";

const contentType =
  'application/ld+json; profile="https://www.w3.org/ns/activitystreams"';

const defaultContext = [
  "https://www.w3.org/ns/activitystreams",
  "https://w3id.org/security/v1",
  { "toot": "http://joinmastodon.org/ns#" },
] as const;

export async function handler(
  req: Request,
  ctx: MiddlewareHandlerContext<{ injector: Injector }>,
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
    const jsonld = ctx.state.injector.inject(JsonLdService);
    return Response.json(
      await jsonld.processDocument({
        "@context": defaultContext,
        ...await rsp.json(),
      }, {
        expandTerms: false,
        expandValues: false,
      }),
      {
        headers: {
          ...rsp.headers,
          "content-type": contentType,
        },
      },
    );
  }
  return rsp;
}
