import { log, Status } from "$/deps.ts";
import { InjectableAbstract, Singleton } from "$/lib/inject.ts";
import { compact } from "$/lib/json-ld/mod.ts";
import { signRequest } from "$/lib/signatures.ts";
import * as urls from "$/lib/urls.ts";
import { AssertFn } from "$/lib/utils.ts";
import { PersonaStoreReadOnly } from "$/models/PersonaStoreReadOnly.ts";
import { TapirConfig } from "$/models/TapirConfig.ts";
import {
  Activity,
  Actor,
  assertIsCollection,
  assertIsCollectionPage,
  assertIsObject,
  CONTENT_TYPE,
  defaultContextJson,
  isCollectionPage,
  Link,
  LinkRefs,
  Object,
} from "$/schemas/activitypub/mod.ts";
import { HttpDispatcher, Priority } from "$/services/HttpDispatcher.ts";
import { JsonLdContextService } from "$/services/JsonLdContextService.ts";

export { Priority } from "$/services/HttpDispatcher.ts";

@InjectableAbstract()
export abstract class ActivityPubClientService {
  abstract getObject<T extends Object = Object>(
    url: URL,
    fromPersona: string,
    priority?: Priority,
    typePredicate?: AssertFn<T>,
  ): Promise<T>;

  abstract publishActivity(
    inbox: URL,
    activity: Activity,
    priority?: Priority,
  ): Promise<Response>;

  abstract publishActivity(
    inboxes: URL[],
    activity: Activity,
    priority?: Priority,
  ): Promise<Response[]>;

  abstract publishActivitiesInOrder(
    inbox: URL,
    activities: Activity[],
    fromPersona: string,
    priority?: Priority,
  ): Promise<AsyncIterable<Response>>;

  async *getCollection<T extends Object = Object>(
    url: URL,
    fromPersona: string,
    priority = Priority.Immediate,
    assertType: AssertFn<T> = assertIsObject,
  ): AsyncGenerator<T> {
    let page = await this.getObject(
      url,
      fromPersona,
      priority,
      assertIsCollection,
    );
    if (isCollectionPage(page) && page.first) {
      if (isCollectionPage(page.first)) page = page.first;
      else {
        const firstUrl = this.getOneLink(page.first);
        if (firstUrl && firstUrl !== url.href) {
          page = await this.getObject(
            new URL(firstUrl),
            fromPersona,
            priority,
            assertIsCollectionPage,
          );
        }
      }
    }
    const nextPage = async (): Promise<boolean> => {
      if (!isCollectionPage(page) || !page.next) return false;
      let next = page.next;
      while (Array.isArray(next)) next = next[0];
      if (typeof next !== "string") {
        if ((next as Link).type === "Link") next = (next as Link).href;
        else if (isCollectionPage(next)) {
          page = next;
          return true;
        }
      }
      if (typeof next !== "string") return false;
      page = await this.getObject(
        new URL(next),
        fromPersona,
        priority,
        assertIsCollection,
      );
      return true;
    };
    let lastBlank = false;
    do {
      const items = page.orderedItems ?? page.items;
      if (!items || Array.isArray(items) && items.length === 0) {
        if (lastBlank) {
          throw new Error("Two consecutive blank pages in collection");
        }
        lastBlank = true;
        continue;
      }
      lastBlank = false;
      for (const item of Array.isArray(items) ? items.flat() : [items]) {
        if (typeof item === "string") {
          yield await this.getObject(
            new URL(item),
            fromPersona,
            priority,
            assertType,
          );
        } else if (typeof item === "object" && (item as Link).type === "Link") {
          yield await this.getObject(
            new URL((item as Link).href),
            fromPersona,
            priority,
            assertType,
          );
        } else {
          assertType(item);
          yield item;
        }
      }
    } while (await nextPage());
  }

  getOneLink(link: null | undefined | LinkRefs): string | undefined {
    if (!link) return undefined;
    else if (Array.isArray(link)) return this.getOneLink(link[0]);
    else if (typeof link === "string") return link;
    else return (link as Link).href;
  }
}

@Singleton(ActivityPubClientService)
export class ActivityPubClientServiceImpl extends ActivityPubClientService {
  constructor(
    private readonly httpDispatcher: HttpDispatcher,
    private readonly jsonLd: JsonLdContextService,
    private readonly config: TapirConfig,
    private readonly personaStore: PersonaStoreReadOnly,
  ) {
    super();
  }

  publishActivity(
    inbox: URL,
    activity: Activity,
    priority?: Priority,
  ): Promise<Response>;

  publishActivity(
    inboxes: URL[],
    activity: Activity,
    priority?: Priority,
  ): Promise<Response[]>;

  async publishActivity(
    inboxes: URL | URL[],
    activity: Activity,
    priority: Priority,
  ): Promise<Response | Response[]> {
    const fromPersona = urls.isActivityPubActor(
      typeof activity.actor === "string"
        ? activity.actor
        : (activity.actor as Actor).id,
      this.config.url,
    );

    if (fromPersona == null) {
      throw new Error(
        `Cannot dispatch activity from actor ${activity.actor}: not a valid persona URL`,
      );
    }

    const responses = await Promise.all(
      (Array.isArray(inboxes) ? inboxes : [inboxes]).map(async (inbox) => {
        try {
          const req = await this.#buildRequest(
            inbox,
            "POST",
            fromPersona,
            JSON.stringify({
              "@context": defaultContextJson["@context"],
              ...activity,
            }),
          );
          log.info(`Dispatching ${activity.type} activity to ${inbox}`);
          const rsp = await this.httpDispatcher.dispatch(req, priority)
            .response;
          if (!rsp.ok) {
            log.error(
              `Activity dispatch to ${inbox} failed: HTTP ${rsp.status} ${rsp.statusText}, ${await rsp
                .text()}`,
            );
          }
          return rsp;
        } catch (e) {
          log.error(`Activity dispatch to ${inbox} failed: ${e?.message ?? e}`);
          return new Response(JSON.stringify({ error: e?.message ?? e }), {
            status: Status.InternalServerError,
            headers: { "content-type": CONTENT_TYPE },
          });
        }
      }),
    );
    return Array.isArray(inboxes) ? responses : responses[0];
  }

  async publishActivitiesInOrder(
    url: URL,
    activities: Activity[],
    fromPersona: string,
    priority: Priority,
  ) {
    const reqs = await Promise.all(
      activities.map((activity) =>
        this.#buildRequest(
          url,
          "POST",
          fromPersona,
          JSON.stringify({
            "@context": defaultContextJson["@context"],
            ...activity,
          }),
        )
      ),
    );
    log.info(`Dispatching ${activities.length} activities to ${url}`);
    const { dispatched, responses } = this.httpDispatcher.dispatchInOrder(
      reqs,
      priority,
    );
    await dispatched;
    return responses;
  }

  async getObject<T extends Object = Object>(
    url: URL,
    fromPersona: string,
    priority = Priority.Immediate,
    assertType: AssertFn<T> = assertIsObject,
  ): Promise<T> {
    log.info(`Requesting: ${url}`);
    const rsp = await this.httpDispatcher.dispatch(
      await this.#buildRequest(url, "GET", fromPersona),
      priority,
    ).response;
    if (rsp.ok) {
      const json = await rsp.json(),
        compacted = await compact(
          json,
          this.jsonLd.resolver,
          await this.jsonLd.defaultContext,
        );
      assertType(
        compacted,
        `ActivityPub request for ${url} returned invalid ActivityPub JSON`,
      );
      return compacted;
    } else {
      throw new Error(
        `ActivityPub request for ${url} failed: HTTP ${rsp.status} ${rsp.statusText}, ${await rsp
          .text()}`,
      );
    }
  }

  async #buildRequest(
    url: URL,
    method: "GET" | "POST",
    personaName: string,
    body?: string,
  ): Promise<Request> {
    const privateKey = await this.personaStore.privateKey(personaName);
    if (!privateKey) {
      throw new Error(
        `Cannot send request as persona ${personaName}: persona does not exist`,
      );
    }
    const req = new Request(url, {
      method,
      headers: {
        "accept": CONTENT_TYPE,
        ...body == null ? {} : { "content-type": CONTENT_TYPE },
      },
      body,
    });
    return signRequest(
      req,
      `${urls.activityPubActor(personaName, this.config.url)}#main-key`,
      privateKey,
    );
  }
}
