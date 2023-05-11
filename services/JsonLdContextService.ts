import { Status } from "$/deps.ts";
import { LfuCache } from "$/lib/cache.ts";
import { LogLevels, Tag } from "$/lib/error.ts";
import { InjectableAbstract, Singleton } from "$/lib/inject.ts";
import {
  Context,
  ContextDefinition,
  ContextResolver,
  ContextSrc,
  FixedContextResolver,
  resolveContext,
} from "$/lib/json-ld/mod.ts";
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

export const BadJsonLd = new Tag("Bad JSON-LD", {
  level: LogLevels.WARNING,
  needsStackTrace: false,
  internal: false,
  httpStatus: Status.BadRequest,
});

@Singleton(JsonLdContextService)
export class HttpJsonLdContextService extends JsonLdContextService {
  static readonly MAX_CHAINED_REQUESTS = 8;
  static readonly MAX_CACHED_CONTEXTS = 64;
  readonly resolver: ContextResolver;
  readonly defaultContext: Promise<Context>;

  constructor(dispatcher: HttpDispatcher) {
    super();
    const cache = new LfuCache<string, Promise<Context>>({
      maxCount: HttpJsonLdContextService.MAX_CACHED_CONTEXTS,
      dynamicAging: true,
    });
    const resolver = new FixedContextResolver({
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
          throw BadJsonLd.error(
            `Cannot resolve JSON-LD context: more than ${HttpJsonLdContextService.MAX_CHAINED_REQUESTS} sequential HTTP requests`,
          );
        }
        return cache.getOrInsert(url, async () => {
          try {
            const rsp = await dispatcher.dispatchAndWait(
                new Request(url, {
                  headers: { accept: "application/ld+json" },
                }),
                { priority: Priority.Soon, throwOnError: BadJsonLd },
              ),
              json = await rsp.json();
            if (
              !json || typeof json !== "object" ||
              !Object.hasOwn(json, "@context")
            ) {
              throw BadJsonLd.error(
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
          } catch (e) {
            throw BadJsonLd.wrap(e);
          }
        });
      },
    });
    this.resolver = resolver;
    this.defaultContext = resolveContext(
      defaultContextJson["@context"] as ContextSrc,
      resolver,
    );
  }
}
