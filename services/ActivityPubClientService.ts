import { InjectableAbstract, Singleton } from "$/lib/inject.ts";
import { signRequest } from "$/lib/signatures.ts";
import {
  Activity,
  Actor,
  assertIsObject,
  Object,
} from "$/schemas/activitypub/mod.ts";
import { TapirConfig } from "$/models/TapirConfig.ts";
import { PersonaStoreReadOnly } from "$/models/PersonaStoreReadOnly.ts";
import { HttpDispatcher, Priority } from "$/services/HttpDispatcher.ts";
import { JsonLdService } from "$/services/JsonLdService.ts";
import { CONTENT_TYPE, defaultContext } from "$/schemas/activitypub/mod.ts";
import * as urls from "$/lib/urls.ts";
import { log, Status } from "$/deps.ts";

export { Priority } from "$/services/HttpDispatcher.ts";

@InjectableAbstract()
export abstract class ActivityPubClientService {
  abstract getObject<T extends Object = Object>(
    url: URL,
    fromPersona: string,
    priority?: Priority,
    typePredicate?: (value: unknown) => value is T,
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
}

@Singleton(ActivityPubClientService)
export class ActivityPubClientServiceImpl extends ActivityPubClientService {
  constructor(
    private readonly httpDispatcher: HttpDispatcher,
    private readonly jsonLd: JsonLdService,
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
            JSON.stringify({ "@context": defaultContext, ...activity }),
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
          JSON.stringify({ "@context": defaultContext, ...activity }),
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
    assertType: (value: unknown, message?: string) => asserts value is T =
      assertIsObject as (
        value: unknown,
        message?: string,
      ) => asserts value is T,
  ): Promise<T> {
    log.info(`Requesting: ${url}`);
    const rsp = await this.httpDispatcher.dispatch(
      await this.#buildRequest(url, "GET", fromPersona),
      priority,
    ).response;
    if (rsp.ok) {
      const json = await rsp.json(),
        compacted = await this.jsonLd.processDocument({
          ...await this.jsonLd.processDocument(json),
          "@context": defaultContext,
        }, { expandTerms: false });
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
