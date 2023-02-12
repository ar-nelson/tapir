import { matchesSchema } from "https://deno.land/x/spartanschema@v1.0.1/mod.ts";
import { Handlers } from "$fresh/server.ts";
import { Injector } from "$/lib/inject.ts";
import { ActivityPubService } from "$/services/ActivityPubService.ts";
import { JsonLdService } from "$/services/JsonLdService.ts";
import { ActivitySchema } from "$/schemas/activitypub/mod.ts";
import defaultContext from "$/schemas/activitypub/defaultContext.json" assert {
  type: "json",
};

const isActivity = matchesSchema(ActivitySchema);

export const handler: Handlers<void, { injector: Injector }> = {
  async POST(req, ctx) {
    const service = ctx.state.injector.resolve(ActivityPubService),
      jsonld = ctx.state.injector.resolve(JsonLdService),
      compacted = await jsonld.processDocument({
        ...await jsonld.processDocument(await req.json()),
        "@context": defaultContext,
      }, { expandTerms: false });
    if (isActivity(compacted)) {
      return service.onInboxPost(ctx.params.name, compacted);
    } else {
      return Response.json({ error: "Request body was not a valid Activity" }, {
        status: 400,
      });
    }
  },
};
