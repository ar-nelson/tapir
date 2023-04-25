import { FixedContextResolver } from "$/lib/json-ld/context.ts";
import { ContextDefinition } from "$/lib/json-ld/types.ts";
import {
  activityStreamsContextJson,
  securityContextJson,
} from "$/schemas/activitypub/mod.ts";

export const MockContextResolver = new FixedContextResolver({
  "https://www.w3.org/ns/activitystreams":
    activityStreamsContextJson["@context"] as ContextDefinition,
  "https://w3id.org/security/v1": securityContextJson["@context"],
});
