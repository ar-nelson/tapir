import { assertEquals, Router } from "$/deps.ts";
import { assertIsActor, CONTENT_TYPE } from "$/schemas/activitypub/mod.ts";
import {
  ActivityPubClientServiceImpl,
  Priority,
} from "$/services/ActivityPubClientService.ts";
import { HttpJsonLdContextService } from "$/services/JsonLdContextService.ts";
import mastodonUserJson from "$/test/data/json-ld/mastodon-user.json" assert {
  type: "json",
};
import { MockHttpDispatcher } from "$/test/mock/MockHttpDispatcher.ts";
import { MockPersonaStore } from "$/test/mock/MockPersonaStore.ts";
import { MockTapirConfig } from "$/test/mock/MockTapirConfig.ts";

function makeClient() {
  const dispatcher = new MockHttpDispatcher(),
    config = new MockTapirConfig(),
    client = new ActivityPubClientServiceImpl(
      dispatcher,
      new HttpJsonLdContextService(dispatcher),
      config,
      new MockPersonaStore(),
    );
  return { dispatcher, client };
}

Deno.test("fetch an actor from a Mastodon server", async () => {
  const { dispatcher, client } = makeClient();
  dispatcher.route(
    "mastodon.local",
    new Router().get("/users/mu", (ctx) => {
      ctx.response.type = "json";
      ctx.response.headers.set("content-type", CONTENT_TYPE);
      ctx.response.body = mastodonUserJson;
    }),
  );
  const actor = await client.getObject(
    new URL("http://mastodon.local/users/mu"),
    "tapir",
    Priority.Soon,
    assertIsActor,
  );
  assertEquals(actor.id, "https://mastodon.local/users/mu");
});
