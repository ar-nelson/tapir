import { Handlers } from "$fresh/server.ts";

export const handler: Handlers = {
  GET(_req, _ctx) {
    return Response.json({ error: "no" }, { status: 403 });
  },
  POST(_req, _ctx) {
    return Response.json({ error: "no" }, { status: 403 });
  },
};
