import {
  generateKeyPair,
  signRequest,
  verifyRequest,
} from "$/lib/signatures.ts";
import { assertEquals } from "asserts";

Deno.test("sign and verify a POST request", async () => {
  const keys = await generateKeyPair(),
    req = new Request("http://example.com", {
      method: "post",
      body: '{ "hello": "world" }',
      headers: {
        "content-type": "application/json",
      },
    }),
    signed = await signRequest(req, "foo", keys.privateKey),
    verification = await verifyRequest(
      signed,
      (n) => Promise.resolve(n === "foo" ? keys.publicKey : undefined),
    );
  if (!verification.verified) {
    assertEquals(verification.error, undefined);
  }
  assertEquals(verification.verified, true);
});

Deno.test("does not verify with a different key", async () => {
  const keys1 = await generateKeyPair(),
    keys2 = await generateKeyPair(),
    req = new Request("http://example.com", {
      method: "post",
      body: '{ "hello": "world" }',
      headers: {
        "content-type": "application/json",
      },
    }),
    signed = await signRequest(req, "foo", keys1.privateKey),
    verification = await verifyRequest(
      signed,
      (n) => Promise.resolve(n === "foo" ? keys2.publicKey : undefined),
    );
  assertEquals(verification.verified, false);
});
