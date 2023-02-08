// DO NOT EDIT. This file is generated by fresh.
// This file SHOULD be checked into source version control.
// This file is automatically updated during development when running `dev.ts`.

import config from "./deno.json" assert { type: "json" };
import * as $0 from "./routes/.well-known/nodeinfo.ts";
import * as $1 from "./routes/.well-known/webfinger.ts";
import * as $2 from "./routes/[name].tsx";
import * as $3 from "./routes/_404.tsx";
import * as $4 from "./routes/_middleware.ts";
import * as $5 from "./routes/api/_middleware.ts";
import * as $6 from "./routes/api/v1/accounts/[acct]/index.ts";
import * as $7 from "./routes/api/v1/accounts/[acct]/statuses.ts";
import * as $8 from "./routes/api/v1/accounts/lookup.ts";
import * as $9 from "./routes/api/v1/instance.ts";
import * as $10 from "./routes/api/v1/statuses/[id]/index.ts";
import * as $11 from "./routes/api/v1/timelines/public.ts";
import * as $12 from "./routes/index.tsx";
import * as $13 from "./routes/nodeinfo/2.0.ts";
import * as $14 from "./routes/toot/[id].tsx";
import * as $15 from "./routes/users/[name]/followers.ts";
import * as $16 from "./routes/users/[name]/following.ts";
import * as $17 from "./routes/users/[name]/inbox.ts";
import * as $18 from "./routes/users/[name]/index.ts";
import * as $19 from "./routes/users/[name]/outbox.ts";
import * as $20 from "./routes/users/[name]/statuses/[id]/activity.ts";
import * as $21 from "./routes/users/[name]/statuses/[id]/index.ts";
import * as $22 from "./routes/users/_middleware.ts";

const manifest = {
  routes: {
    "./routes/.well-known/nodeinfo.ts": $0,
    "./routes/.well-known/webfinger.ts": $1,
    "./routes/[name].tsx": $2,
    "./routes/_404.tsx": $3,
    "./routes/_middleware.ts": $4,
    "./routes/api/_middleware.ts": $5,
    "./routes/api/v1/accounts/[acct]/index.ts": $6,
    "./routes/api/v1/accounts/[acct]/statuses.ts": $7,
    "./routes/api/v1/accounts/lookup.ts": $8,
    "./routes/api/v1/instance.ts": $9,
    "./routes/api/v1/statuses/[id]/index.ts": $10,
    "./routes/api/v1/timelines/public.ts": $11,
    "./routes/index.tsx": $12,
    "./routes/nodeinfo/2.0.ts": $13,
    "./routes/toot/[id].tsx": $14,
    "./routes/users/[name]/followers.ts": $15,
    "./routes/users/[name]/following.ts": $16,
    "./routes/users/[name]/inbox.ts": $17,
    "./routes/users/[name]/index.ts": $18,
    "./routes/users/[name]/outbox.ts": $19,
    "./routes/users/[name]/statuses/[id]/activity.ts": $20,
    "./routes/users/[name]/statuses/[id]/index.ts": $21,
    "./routes/users/_middleware.ts": $22,
  },
  islands: {},
  baseUrl: import.meta.url,
  config,
};

export default manifest;
