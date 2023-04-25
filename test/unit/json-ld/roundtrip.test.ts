import { assertEquals } from "$/deps.ts";
import { compact, expand } from "$/lib/json-ld/mod.ts";
import { MockContextResolver } from "$/test/mock/MockContextResolver.ts";

import createWithImageJson from "$/test/data/json-ld/create-with-image.json" assert {
  type: "json",
};
import mastodonUserJson from "$/test/data/json-ld/mastodon-user.json" assert {
  type: "json",
};

Deno.test("can expand a Create activity", async () => {
  assertEquals(
    await expand(createWithImageJson, MockContextResolver),
    [
      {
        "https://www.w3.org/ns/activitystreams#attachment": [
          {
            "http://joinmastodon.org/ns#blurhash": [
              {
                "@value": "UBL_:rOpGG-oBUNG,qRj2so|=eE1w^n4S5NH",
              },
            ],
            "https://www.w3.org/ns/activitystreams#mediaType": [
              {
                "@value": "image/png",
              },
            ],
            "@type": [
              "https://www.w3.org/ns/activitystreams#Image",
            ],
            "https://www.w3.org/ns/activitystreams#url": [
              {
                "@id": "https://example.com/files/cats.png",
              },
            ],
          },
        ],
        "https://www.w3.org/ns/activitystreams#content": [
          {
            "@value": "A picture attached!",
          },
        ],
        "@id": "https://example.com/@alice/hello-world",
        "@type": [
          "https://www.w3.org/ns/activitystreams#Note",
        ],
      },
    ],
  );
});

Deno.test("can expand a Mastodon user", async () => {
  assertEquals(
    await expand(mastodonUserJson, MockContextResolver),
    [
      {
        "http://joinmastodon.org/ns#devices": [
          {
            "@id": "https://mastodon.local/users/mu/collections/devices",
          },
        ],
        "http://joinmastodon.org/ns#discoverable": [
          {
            "@value": false,
          },
        ],
        "https://www.w3.org/ns/activitystreams#endpoints": [
          {
            "https://www.w3.org/ns/activitystreams#sharedInbox": [
              {
                "@id": "https://mastodon.local/inbox",
              },
            ],
          },
        ],
        "http://joinmastodon.org/ns#featured": [
          {
            "@id": "https://mastodon.local/users/mu/collections/featured",
          },
        ],
        "http://joinmastodon.org/ns#featuredTags": [
          {
            "@id": "https://mastodon.local/users/mu/collections/tags",
          },
        ],
        "https://www.w3.org/ns/activitystreams#followers": [
          {
            "@id": "https://mastodon.local/users/mu/followers",
          },
        ],
        "https://www.w3.org/ns/activitystreams#following": [
          {
            "@id": "https://mastodon.local/users/mu/following",
          },
        ],
        "@id": "https://mastodon.local/users/mu",
        "http://www.w3.org/ns/ldp#inbox": [
          {
            "@id": "https://mastodon.local/users/mu/inbox",
          },
        ],
        "https://www.w3.org/ns/activitystreams#manuallyApprovesFollowers": [
          {
            "@value": false,
          },
        ],
        "https://www.w3.org/ns/activitystreams#name": [
          {
            "@value": "",
          },
        ],
        "https://www.w3.org/ns/activitystreams#outbox": [
          {
            "@id": "https://mastodon.local/users/mu/outbox",
          },
        ],
        "https://www.w3.org/ns/activitystreams#preferredUsername": [
          {
            "@value": "mu",
          },
        ],
        "https://w3id.org/security#publicKey": [
          {
            "@id": "https://mastodon.local/users/mu#main-key",
            "https://w3id.org/security#owner": [
              {
                "@id": "https://mastodon.local/users/mu",
              },
            ],
            "https://w3id.org/security#publicKeyPem": [
              {
                "@value":
                  "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAstiEiHANebbpFSIP+9V0\npAeHn13xvOGA4BAyWy6DQvbbQe4S93TMbebFfwkCr8nzWCNGCq5rInOZqIh8Twbq\n4V8i42edLrXbONq88DGIasbYoqsS1hXb3FOSDSoO8iiz21pQDWSJZg55s2szgjx8\nYNwY6B7BjYdqSmpP4LHB/Ak4KzclbtDocTwrvGdFXH6uIV3FutX5FBRBmnfHwvva\neq3qYim6V69TizkYS3Gx1V4wCv7z1bJFW4yXczG5ALmzjLZ1Kq225HnoYqkBrVUD\namuJZslfvf+BQToPeJ1FDn6hm/g/HyLM2ziRkOj8vyUobcSy0wpcMN3cUCZPqLKH\nxwIDAQAB\n-----END PUBLIC KEY-----\n",
              },
            ],
          },
        ],
        "https://www.w3.org/ns/activitystreams#published": [
          {
            "@type": "http://www.w3.org/2001/XMLSchema#dateTime",
            "@value": "2023-04-13T00:00:00Z",
          },
        ],
        "https://www.w3.org/ns/activitystreams#summary": [
          {
            "@value": "",
          },
        ],
        "@type": [
          "https://www.w3.org/ns/activitystreams#Person",
        ],
        "https://www.w3.org/ns/activitystreams#url": [
          {
            "@id": "https://mastodon.local/@mu",
          },
        ],
      },
    ],
  );
});

Deno.test("can compact a Create activity", async () => {
  assertEquals(
    await compact(
      createWithImageJson,
      MockContextResolver,
      "https://www.w3.org/ns/activitystreams",
    ),
    {
      "@context": "https://www.w3.org/ns/activitystreams",
      "id": "https://example.com/@alice/hello-world",
      "type": "Note",
      "attachment": {
        "type": "Image",
        "http://joinmastodon.org/ns#blurhash":
          "UBL_:rOpGG-oBUNG,qRj2so|=eE1w^n4S5NH",
        "mediaType": "image/png",
        "url": "https://example.com/files/cats.png",
      },
      "content": "A picture attached!",
    },
  );
});

Deno.test("can compact a Person object", async () => {
  assertEquals(
    await compact(mastodonUserJson, MockContextResolver, [
      "https://www.w3.org/ns/activitystreams",
      "https://w3id.org/security/v1",
      {
        "toot": "http://joinmastodon.org/ns#",
      },
    ]),
    {
      "@context": [
        "https://www.w3.org/ns/activitystreams",
        "https://w3id.org/security/v1",
        {
          "toot": "http://joinmastodon.org/ns#",
        },
      ],
      "id": "https://mastodon.local/users/mu",
      "type": "Person",
      "toot:devices": "https://mastodon.local/users/mu/collections/devices",
      "toot:discoverable": false,
      "toot:featured": "https://mastodon.local/users/mu/collections/featured",
      "toot:featuredTags": "https://mastodon.local/users/mu/collections/tags",
      "inbox": "https://mastodon.local/users/mu/inbox",
      "publicKey": {
        "id": "https://mastodon.local/users/mu#main-key",
        "owner": "https://mastodon.local/users/mu",
        "publicKeyPem":
          "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAstiEiHANebbpFSIP+9V0\npAeHn13xvOGA4BAyWy6DQvbbQe4S93TMbebFfwkCr8nzWCNGCq5rInOZqIh8Twbq\n4V8i42edLrXbONq88DGIasbYoqsS1hXb3FOSDSoO8iiz21pQDWSJZg55s2szgjx8\nYNwY6B7BjYdqSmpP4LHB/Ak4KzclbtDocTwrvGdFXH6uIV3FutX5FBRBmnfHwvva\neq3qYim6V69TizkYS3Gx1V4wCv7z1bJFW4yXczG5ALmzjLZ1Kq225HnoYqkBrVUD\namuJZslfvf+BQToPeJ1FDn6hm/g/HyLM2ziRkOj8vyUobcSy0wpcMN3cUCZPqLKH\nxwIDAQAB\n-----END PUBLIC KEY-----\n",
      },
      "endpoints": {
        "sharedInbox": "https://mastodon.local/inbox",
      },
      "followers": "https://mastodon.local/users/mu/followers",
      "following": "https://mastodon.local/users/mu/following",
      "as:manuallyApprovesFollowers": false,
      "name": "",
      "outbox": "https://mastodon.local/users/mu/outbox",
      "preferredUsername": "mu",
      "published": "2023-04-13T00:00:00Z",
      "summary": "",
      "url": "https://mastodon.local/@mu",
    },
  );
});
