import * as base64 from "https://deno.land/std@0.176.0/encoding/base64.ts";

export function generateKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
      hash: { name: "SHA-256" },
    },
    true,
    ["sign", "verify"],
  );
}

export async function publicKeyToPem(key: CryptoKey): Promise<string> {
  return `-----BEGIN PUBLIC KEY-----
${base64.encode(await crypto.subtle.exportKey("spki", key))}
-----END PUBLIC KEY-----
`;
}

export function publicKeyFromPem(pem: string): Promise<CryptoKey> {
  const match =
    /-----\s*BEGIN[\w\s]+PUBLIC[\w\s]+-----([a-zA-Z0-9\/+=\s]+)-----\s*END[\w\s]+PUBLIC[\w\s]+-----\s*/m
      .exec(pem);
  if (!match) {
    throw new TypeError(`String is not a PEM public key: \n${pem}`);
  }
  return crypto.subtle.importKey(
    "spki",
    base64.decode(match[1].replaceAll(/\s+/g, "")),
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: { name: "SHA-256" },
    },
    true,
    ["verify"],
  );
}
