import { TagError } from "$/lib/error.ts";
import {
  generateKeyPair,
  signRequest,
  verifyRequest,
} from "$/lib/signatures.ts";
import { assertRejects } from "asserts";

Deno.test("sign and verify a POST request", async () => {
  const keys = await generateKeyPair(),
    req = new Request("http://example.com", {
      method: "post",
      body: '{ "hello": "world" }',
      headers: {
        "content-type": "application/json",
      },
    }),
    signed = await signRequest(req, "foo", keys.privateKey);
  await verifyRequest(
    signed,
    (n) => Promise.resolve(n === "foo" ? keys.publicKey : undefined),
  );
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
    signed = await signRequest(req, "foo", keys1.privateKey);
  assertRejects(() =>
    verifyRequest(
      signed,
      (n) => Promise.resolve(n === "foo" ? keys2.publicKey : undefined),
    ), TagError);
});
