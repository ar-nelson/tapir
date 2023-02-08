import { MiddlewareHandlerContext } from "$fresh/server.ts";
import { Injector } from "$/lib/inject.ts";
import { contentTypeIsJson } from "$/lib/urls.ts";
import { JsonLdService } from "$/services/JsonLdService.ts";

const contentType =
  'application/ld+json; profile="https://www.w3.org/ns/activitystreams"';

const defaultContext = [
  "https://www.w3.org/ns/activitystreams",
  "https://w3id.org/security/v1",
  {
    "manuallyApprovesFollowers": "as:manuallyApprovesFollowers",
    "toot": "http://joinmastodon.org/ns#",
    "featured": {
      "@id": "toot:featured",
      "@type": "@id",
    },
    "featuredTags": {
      "@id": "toot:featuredTags",
      "@type": "@id",
    },
    "alsoKnownAs": {
      "@id": "as:alsoKnownAs",
      "@type": "@id",
    },
    "movedTo": {
      "@id": "as:movedTo",
      "@type": "@id",
    },
    "schema": "http://schema.org#",
    "PropertyValue": "schema:PropertyValue",
    "value": "schema:value",
    "discoverable": "toot:discoverable",
    "Device": "toot:Device",
    "Ed25519Signature": "toot:Ed25519Signature",
    "Ed25519Key": "toot:Ed25519Key",
    "Curve25519Key": "toot:Curve25519Key",
    "EncryptedMessage": "toot:EncryptedMessage",
    "publicKeyBase64": "toot:publicKeyBase64",
    "deviceId": "toot:deviceId",
    "claim": {
      "@type": "@id",
      "@id": "toot:claim",
    },
    "fingerprintKey": {
      "@type": "@id",
      "@id": "toot:fingerprintKey",
    },
    "identityKey": {
      "@type": "@id",
      "@id": "toot:identityKey",
    },
    "devices": {
      "@type": "@id",
      "@id": "toot:devices",
    },
    "messageFranking": "toot:messageFranking",
    "messageType": "toot:messageType",
    "cipherText": "toot:cipherText",
    "suspended": "toot:suspended",
    "Hashtag": "as:Hashtag",
    "focalPoint": {
      "@container": "@list",
      "@id": "toot:focalPoint",
    },
  },
] as const;

export async function handler(
  req: Request,
  ctx: MiddlewareHandlerContext<{ injector: Injector }>,
) {
  // if (!contentTypeIsJson(req.headers.get("accept") || "")) {
  //   return Response.json({
  //     error:
  //       `Requests to ActivityPub endpoints must include the HTTP header Accept: ${contentType}`,
  //   }, { status: 406 });
  // }
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
    const jsonld = ctx.state.injector.inject(JsonLdService);
    return Response.json(
      await jsonld.processDocument({
        "@context": defaultContext,
        ...await rsp.json(),
      }, {
        expandTerms: false,
        expandValues: false,
        usedLiterals: new Set(),
      }),
      {
        headers: {
          ...rsp.headers,
          "content-type": contentType,
        },
      },
    );
  }
  return rsp;
}
