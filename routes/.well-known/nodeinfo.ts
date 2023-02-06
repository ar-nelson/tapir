import { Handlers } from "$fresh/server.ts";

export const handler: Handlers = {
  GET(_req, _ctx) {
    return Response.json({
      "links": [
        {
          "rel": "http://nodeinfo.diaspora.software/ns/schema/2.0",
          "href": "/nodeinfo/2.0",
        },
      ],
    });
  },
};
