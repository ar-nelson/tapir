import { InjectableAbstract, Singleton } from "$/lib/inject.ts";
import { JsonLdContext, JsonLdError } from "$/lib/jsonld.ts";
import { HttpDispatcher, Priority } from "$/services/HttpDispatcher.ts";

@InjectableAbstract()
export abstract class JsonLdContextFetcherService {
  abstract getContext(iri: string): Promise<JsonLdContext>;
}

@Singleton(JsonLdContextFetcherService)
export class HttpJsonLdContextFetcherService {
  constructor(private readonly dispatcher: HttpDispatcher) {}

  async getContext(iri: string): Promise<JsonLdContext> {
    const rsp = await this.dispatcher.dispatch(
      new Request(iri, { headers: { accept: "application/ld+json" } }),
      Priority.Soon,
    ).response;
    const json = await rsp.json();
    if (
      json && typeof json === "object" && json["@context"] &&
      typeof json["@context"] === "object"
    ) {
      return json["@context"];
    } else {
      throw new JsonLdError(
        `The JSON data at ${
          JSON.stringify(iri)
        } does not have a '@context' object`,
      );
    }
  }
}
