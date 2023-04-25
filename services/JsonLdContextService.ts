import { LfuCache } from "$/lib/cache.ts";
import { InjectableAbstract, Singleton } from "$/lib/inject.ts";
import {
  Context,
  ContextDefinition,
  ContextResolver,
  ContextSrc,
  FixedContextResolver,
  resolveContext,
} from "$/lib/json-ld/mod.ts";
import * as urls from "$/lib/urls.ts";
import { TapirConfig } from "$/models/TapirConfig.ts";
import {
  activityStreamsContextJson,
  defaultContextJson,
  securityContextJson,
} from "$/schemas/activitypub/mod.ts";
import { HttpDispatcher, Priority } from "$/services/HttpDispatcher.ts";

@InjectableAbstract()
export abstract class JsonLdContextService {
  abstract readonly resolver: ContextResolver;
  abstract readonly defaultContext: Promise<Context>;
}

@Singleton(JsonLdContextService)
export class HttpJsonLdContextService extends JsonLdContextService {
  static readonly MAX_CHAINED_REQUESTS = 8;
  static readonly MAX_CACHED_CONTEXTS = 64;
  readonly resolver: ContextResolver;
  readonly defaultContext: Promise<Context>;

  constructor(
    dispatcher: HttpDispatcher,
    config: TapirConfig,
  ) {
    super();
    const cache = new LfuCache<string, Promise<Context>>({
      maxCount: HttpJsonLdContextService.MAX_CACHED_CONTEXTS,
      dynamicAging: true,
    });
    const resolver = new FixedContextResolver(
      {
        [urls.activityPubContext(config.url)]:
          defaultContextJson["@context"] as ContextSrc,
      },
      new FixedContextResolver({
        "https://www.w3.org/ns/activitystreams":
          activityStreamsContextJson["@context"] as ContextDefinition,
        "https://w3id.org/security/v1": securityContextJson["@context"],
      }, {
        resolve(
          url: string,
          activeContext?: Context,
          history: string[] = [],
        ): Promise<Context> {
          if (
            history.length >
              HttpJsonLdContextService.MAX_CHAINED_REQUESTS
          ) {
            throw new Error(
              `Cannot resolve JSON-LD context: more than ${HttpJsonLdContextService.MAX_CHAINED_REQUESTS} sequential HTTP requests`,
            );
          }
          return cache.getOrInsert(url, async () => {
            const rsp = await dispatcher.dispatch(
                new Request(url, {
                  headers: { accept: "application/ld+json" },
                }),
                Priority.Soon,
              ).response,
              json = await rsp.json();
            if (
              !json || typeof json !== "object" ||
              !Object.hasOwn(json, "@context")
            ) {
              throw new Error(
                `Cannot resolve JSON-LD context: the JSON data at ${
                  JSON.stringify(url)
                } does not have a '@context' object`,
              );
            }
            return resolveContext(
              json["@context"],
              resolver,
              activeContext,
              history,
            );
          });
        },
      }),
    );
    this.resolver = resolver;
    this.defaultContext = resolver.resolve(urls.activityPubContext(config.url));
  }
}
