import { MiddlewareHandlerContext } from "$fresh/server.ts";
import { contentTypeIsJson } from "$/lib/urls.ts";
import { BlockedServerStore } from "$/models/BlockedServer.ts";
import {
  ActivityPubController,
  HandlerState,
} from "$/controllers/ActivityPubController.ts";
import { CONTENT_TYPE } from "$/schemas/activitypub/mod.ts";
import defaultContext from "$/schemas/activitypub/defaultContext.json" assert {
  type: "json",
};
import * as log from "https://deno.land/std@0.176.0/log/mod.ts";

export async function handler(
  req: Request,
  ctx: MiddlewareHandlerContext<HandlerState>,
) {
  ctx.state.controller = await ctx.state.injector.resolve(
    ActivityPubController,
  );
  // if (!contentTypeIsJson(req.headers.get("accept") || "")) {
  //   return Response.json({
  //     error:
  //       `Requests to ActivityPub endpoints must include the HTTP header Accept: ${contentType}`,
  //   }, { status: 406 });
  // }
  if (req.method === "POST") {
    const json = req.clone().json() as { id?: unknown; actor?: unknown },
      { id, actor } = json,
      blockedServerStore = await ctx.state.injector.resolve(BlockedServerStore);
    const idUrl = typeof id === "string" && new URL(id);
    if (idUrl && await blockedServerStore.blocksActivityUrl(idUrl)) {
      log.info(
        `Rejected ActivityPub POST from blocked domain ${idUrl.hostname}`,
      );
      return Response.json({ error: "Blocked" }, { status: 403 });
    }
    const actorUrl = typeof actor === "string" && new URL(actor);
    if (actorUrl && await blockedServerStore.blocksActivityUrl(actorUrl)) {
      log.info(
        `Rejected ActivityPub POST from blocked domain ${
          new URL(actor).hostname
        }`,
      );
      return Response.json({ error: "Blocked" }, { status: 403 });
    }
  }
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
