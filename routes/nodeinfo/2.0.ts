import { Handlers } from "$fresh/server.ts";

export const handler: Handlers = {
  GET(_req, _ctx) {
    return Response.json(
      {
        "version": "2.0",
        "software": {
          "name": "tapir",
          "version": "0.0.0.0.0.0.0.0.0.0.0.0.0.1",
        },
        "protocols": ["activitypub"],
        "services": { "outbound": [], "inbound": [] },
        "usage": {
          "users": {
            "total": 1,
            "activeMonth": 1,
            "activeHalfyear": 1,
          },
          "localPosts": 1,
        },
        "openRegistrations": false,
        "metadata": {},
      },
    );
  },
};
