import { Handlers } from "$fresh/server.ts";
import { Injector } from "$/lib/inject.ts";
import { WebFingerController } from "$/controllers/WebFingerController.ts";

export const handler: Handlers<void, { injector: Injector }> = {
  async GET(req, ctx) {
    const url = new URL(req.url),
      service = await ctx.state.injector.resolve(WebFingerController),
      resource = url.searchParams.get("resource");
    if (resource == null) {
      return Response.json({ error: "No resource given" }, { status: 400 });
    }
    const response = await service.queryResource(resource);
    if (response == null) {
      return Response.json({ error: "Resource not found" }, { status: 404 });
    }
    return Response.json(response);
  },
};
