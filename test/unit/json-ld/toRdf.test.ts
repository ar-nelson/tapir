import { assertEquals } from "$/deps.ts";
import { rdfToString, toRdf } from "$/lib/json-ld/mod.ts";
import { MockContextResolver } from "$/test/mock/MockContextResolver.ts";

import createWithImageJson from "$/test/data/json-ld/create-with-image.json" assert {
  type: "json",
};
import mastodonUserJson from "$/test/data/json-ld/mastodon-user.json" assert {
  type: "json",
};

Deno.test("can serialize a Create activity", async () => {
  assertEquals(
    rdfToString(await toRdf(createWithImageJson, MockContextResolver)),
    `<https://example.com/@alice/hello-world> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://www.w3.org/ns/activitystreams#Note> .
<https://example.com/@alice/hello-world> <https://www.w3.org/ns/activitystreams#attachment> _:b0 .
<https://example.com/@alice/hello-world> <https://www.w3.org/ns/activitystreams#content> "A picture attached!" .
_:b0 <http://joinmastodon.org/ns#blurhash> "UBL_:rOpGG-oBUNG,qRj2so|=eE1w^n4S5NH" .
_:b0 <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://www.w3.org/ns/activitystreams#Image> .
_:b0 <https://www.w3.org/ns/activitystreams#mediaType> "image/png" .
_:b0 <https://www.w3.org/ns/activitystreams#url> <https://example.com/files/cats.png> .
`,
  );
});

Deno.test("can serialize a Person object", async () => {
  assertEquals(
    rdfToString(await toRdf(mastodonUserJson, MockContextResolver)),
    `<https://mastodon.local/users/mu#main-key> <https://w3id.org/security#owner> <https://mastodon.local/users/mu> .
<https://mastodon.local/users/mu#main-key> <https://w3id.org/security#publicKeyPem> "-----BEGIN PUBLIC KEY-----\\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAstiEiHANebbpFSIP+9V0\\npAeHn13xvOGA4BAyWy6DQvbbQe4S93TMbebFfwkCr8nzWCNGCq5rInOZqIh8Twbq\\n4V8i42edLrXbONq88DGIasbYoqsS1hXb3FOSDSoO8iiz21pQDWSJZg55s2szgjx8\\nYNwY6B7BjYdqSmpP4LHB/Ak4KzclbtDocTwrvGdFXH6uIV3FutX5FBRBmnfHwvva\\neq3qYim6V69TizkYS3Gx1V4wCv7z1bJFW4yXczG5ALmzjLZ1Kq225HnoYqkBrVUD\\namuJZslfvf+BQToPeJ1FDn6hm/g/HyLM2ziRkOj8vyUobcSy0wpcMN3cUCZPqLKH\\nxwIDAQAB\\n-----END PUBLIC KEY-----\\n" .
<https://mastodon.local/users/mu> <http://joinmastodon.org/ns#devices> <https://mastodon.local/users/mu/collections/devices> .
<https://mastodon.local/users/mu> <http://joinmastodon.org/ns#discoverable> "false"^^<http://www.w3.org/2001/XMLSchema#boolean> .
<https://mastodon.local/users/mu> <http://joinmastodon.org/ns#featured> <https://mastodon.local/users/mu/collections/featured> .
<https://mastodon.local/users/mu> <http://joinmastodon.org/ns#featuredTags> <https://mastodon.local/users/mu/collections/tags> .
<https://mastodon.local/users/mu> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://www.w3.org/ns/activitystreams#Person> .
<https://mastodon.local/users/mu> <http://www.w3.org/ns/ldp#inbox> <https://mastodon.local/users/mu/inbox> .
<https://mastodon.local/users/mu> <https://w3id.org/security#publicKey> <https://mastodon.local/users/mu#main-key> .
<https://mastodon.local/users/mu> <https://www.w3.org/ns/activitystreams#endpoints> _:b0 .
<https://mastodon.local/users/mu> <https://www.w3.org/ns/activitystreams#followers> <https://mastodon.local/users/mu/followers> .
<https://mastodon.local/users/mu> <https://www.w3.org/ns/activitystreams#following> <https://mastodon.local/users/mu/following> .
<https://mastodon.local/users/mu> <https://www.w3.org/ns/activitystreams#manuallyApprovesFollowers> "false"^^<http://www.w3.org/2001/XMLSchema#boolean> .
<https://mastodon.local/users/mu> <https://www.w3.org/ns/activitystreams#name> "" .
<https://mastodon.local/users/mu> <https://www.w3.org/ns/activitystreams#outbox> <https://mastodon.local/users/mu/outbox> .
<https://mastodon.local/users/mu> <https://www.w3.org/ns/activitystreams#preferredUsername> "mu" .
<https://mastodon.local/users/mu> <https://www.w3.org/ns/activitystreams#published> "2023-04-13T00:00:00Z"^^<http://www.w3.org/2001/XMLSchema#dateTime> .
<https://mastodon.local/users/mu> <https://www.w3.org/ns/activitystreams#summary> "" .
<https://mastodon.local/users/mu> <https://www.w3.org/ns/activitystreams#url> <https://mastodon.local/@mu> .
_:b0 <https://www.w3.org/ns/activitystreams#sharedInbox> <https://mastodon.local/inbox> .
`,
  );
});

Deno.test("doesn't apply @type to irrelevant expansions", async () => {
  assertEquals(
    rdfToString(
      await toRdf(
        {
          "@context": {
            ex: "http://example.com/",
            foo: "ex:fhqwhgads",
            "ex:qux": { "@type": "@id" },
          },
          foo: "bar",
          "http://example.com/qux": "http://example.com/bar",
        } as any,
      ),
    ),
    `_:b0 <http://example.com/fhqwhgads> "bar" .
_:b0 <http://example.com/qux> "http://example.com/bar" .
`,
  );
});
