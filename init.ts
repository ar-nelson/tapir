import { generateKeyPair } from "$/lib/signatures.ts";
import { checkPersonaName, hashPassword } from "$/lib/utils.ts";
import { schema, ServerConfig } from "$/schemas/tapir/ServerConfig.ts";
import { matchesSchema } from "https://deno.land/x/spartanschema@v1.0.1/mod.ts";
import * as base64 from "https://deno.land/std@0.176.0/encoding/base64.ts";

console.log("--- Tapir Setup ---");
console.log("This will generate a tapir.json file.");
alert("If you already have a tapir.json file, this script will overwrite it!");

const domain = prompt("Domain (e.g., tapir.social):")!,
  loginName = prompt("Login name:")!;

checkPersonaName(loginName);

const password = prompt("Password (visible!):");

if (!password || password.length < 8) {
  console.error("Password must be at least 8 characters");
  Deno.exit(1);
}

const salt = crypto.getRandomValues(new Uint8Array(16)),
  hash = hashPassword(password, salt),
  keyPair = await generateKeyPair(),
  json: ServerConfig = {
    domain,
    url: `https://${domain}`,
    loginName,
    passwordHash: base64.encode(hash),
    passwordSalt: base64.encode(salt),
    dataDir: "data",
    localDatabase: { type: "sqlite" },
    publicKey: (await crypto.subtle.exportKey(
      "jwk",
      keyPair.publicKey,
    )) as unknown as ServerConfig["publicKey"],
    privateKey: (await crypto.subtle.exportKey(
      "jwk",
      keyPair.privateKey,
    )) as unknown as ServerConfig["privateKey"],
  };

if (!matchesSchema(schema)(json)) {
  console.error("JSON doesn't match schema for some reason");
  console.error("flagrant system error, bailing out");
  Deno.exit(1);
}

console.log("Writing file...");

await Deno.writeTextFile("tapir.json", JSON.stringify(json, null, 2));

console.log("Wrote tapir.json.");
console.log("!! BE CAREFUL, THIS FILE HAS A PRIVATE KEY IN IT !!");
console.log("Do not commit this file to source control!");
