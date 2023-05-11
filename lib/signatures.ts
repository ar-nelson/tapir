import { Status } from "$/deps.ts";
import { datetime, diffInMin } from "$/lib/datetime/mod.ts";
import { LogLevels, Tag } from "$/lib/error.ts";
import * as base64 from "base64";

export const BadKeyFormat = new Tag("Bad Key Format");
export const BadSignature = new Tag("Bad Signature", {
  level: LogLevels.WARNING,
  needsStackTrace: false,
  internal: false,
  httpStatus: Status.Unauthorized,
});

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
  return `-----BEGIN PUBLIC KEY-----\r
${base64.encode(await crypto.subtle.exportKey("spki", key))}\r
-----END PUBLIC KEY-----\r
`;
}

export function publicKeyFromPem(pem: string): Promise<CryptoKey> {
  const match =
    /-----\s*BEGIN[\w\s]+PUBLIC[\w\s]+-----([a-zA-Z0-9\/+=\s]+)-----\s*END[\w\s]+PUBLIC[\w\s]+-----\s*/m
      .exec(pem);
  if (!match) {
    throw BadKeyFormat.error(`String is not a PEM public key: \n${pem}`);
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

async function sha256(buf: ArrayBuffer) {
  return base64.encode(await crypto.subtle.digest("SHA-256", buf));
}

export async function signRequest(
  request: Request,
  keyName: string,
  privateKey: CryptoKey,
): Promise<Request> {
  const headers = [
      "(request-target)",
      "date",
      "host",
      ...(request.method === "GET" ? [] : ["content-type", "digest"]),
    ],
    url = new URL(request.url),
    linesToSign: string[] = [];
  for (const h of headers) {
    let s;
    switch (h) {
      case "(request-target)":
        s = `${request.method.toLowerCase()} ${url.pathname}${url.search}`;
        break;
      case "date":
        if (request.headers.has(h)) {
          s = request.headers.get(h)!;
        } else {
          request.headers.append(h, s = new Date().toUTCString());
        }
        break;
      case "host":
        if (request.headers.has(h)) {
          s = request.headers.get(h)!;
        } else {
          request.headers.append(h, s = url.host);
        }
        break;
      case "digest":
        if (request.headers.has(h)) {
          s = request.headers.get(h)!;
        } else {
          request.headers.append(
            h,
            s = `SHA-256=${await sha256(
              await request.clone().arrayBuffer(),
            )}`,
          );
        }
        break;
      default:
        s = request.headers.get(h) ?? "";
    }
    linesToSign.push(`${h}: ${s}`);
  }
  const sig = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5", hash: { name: "SHA-256" } },
    privateKey,
    new TextEncoder().encode(linesToSign.join("\n")),
  );
  request.headers.append(
    "signature",
    `keyId=${JSON.stringify(keyName)},algorithm="rsa-sha256",headers="${
      headers.join(" ")
    }",signature="${base64.encode(sig)}"`,
  );
  return request;
}

export async function verifyRequest(
  request: Request,
  lookupPublicKey: (keyName: string) => Promise<CryptoKey | undefined>,
): Promise<void> {
  const url = new URL(request.url),
    match =
      /keyId="([^"]+)",algorithm="([^"]+)",headers="([^"]+)",signature="([a-zA-Z0-9\/+=]+)"/
        .exec(request.headers.get("signature") || "");
  if (!match) {
    throw BadSignature.error("Malformed signature header");
  }
  const [, keyName, algorithm, headersString, base64Sig] = match;
  if (algorithm !== "rsa-sha256") {
    throw BadSignature.error("Signature is not rsa-sha256");
  }

  const headers = headersString.split(" "),
    required = [
      "(request-target)",
      "date",
      "host",
      ...(request.method === "GET" ? [] : ["digest"]),
    ].filter((h) => !headersString.includes(h));

  if (required.length) {
    throw BadSignature.error(
      `Required headers missing: ${JSON.stringify(required)}`,
    );
  }

  let publicKey: CryptoKey | undefined;
  try {
    publicKey = await lookupPublicKey(keyName);
  } catch (e) {
    throw BadSignature.error(
      `Failed to fetch public key for keyId=${JSON.stringify(keyName)}`,
      e,
    );
  }
  if (!publicKey) {
    throw BadSignature.error(
      `No public key for keyId=${JSON.stringify(keyName)}`,
    );
  }

  const linesToSign: string[] = [];
  for (const h of headers) {
    let s;
    switch (h) {
      case "(request-target)":
        s = `${request.method.toLowerCase()} ${url.pathname}`;
        break;
      case "date":
        s = request.headers.get(h) ?? "";
        try {
          const minutes = diffInMin(datetime(new Date(s)), datetime());
          if (Math.abs(minutes) > 30) {
            throw BadSignature.error(`Date out of range: ${JSON.stringify(s)}`);
          }
        } catch (e) {
          throw BadSignature.error(
            `Cannot parse date header ${JSON.stringify(s)}`,
            e,
          );
        }
        if (request.headers.has(h)) {
          s = request.headers.get(h)!;
        } else {
          request.headers.append(h, s = new Date().toUTCString());
        }
        break;
      case "host":
        s = request.headers.get(h) ?? "";
        if (!s) throw BadSignature.error("No host header");
        break;
      case "digest": {
        s = request.headers.get(h) ?? "";
        const expected = `SHA-256=${
          base64.encode(
            await crypto.subtle.digest(
              "SHA-256",
              await request.clone().arrayBuffer(),
            ),
          )
        }`;
        if (s !== expected) {
          throw BadSignature.error(
            `Digest header ${JSON.stringify(s)} did not match content`,
          );
        }
        break;
      }
      default:
        s = request.headers.get(h) ?? "";
    }
    linesToSign.push(`${h}: ${s}`);
  }

  const verified = await crypto.subtle.verify(
    { name: "RSASSA-PKCS1-v1_5", hash: { name: "SHA-256" } },
    publicKey,
    base64.decode(base64Sig),
    new TextEncoder().encode(linesToSign.join("\n")),
  );

  if (!verified) throw BadSignature.error("Signature does not match");
}
