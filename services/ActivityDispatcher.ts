import { InjectableAbstract, Singleton } from "$/lib/inject.ts";
import { signRequest } from "$/lib/signatures.ts";
import {
  Activity,
  Actor,
  isActor,
  isObject,
  key,
  Object,
} from "$/schemas/activitypub/mod.ts";
import { PersonaStoreReadOnly } from "$/models/PersonaStoreReadOnly.ts";
import { InFollowStoreReadOnly } from "$/models/InFollowStoreReadOnly.ts";
import { KnownServerStoreReadOnly } from "$/models/KnownServer.ts";
import { BlockedServerStoreReadOnly } from "$/models/BlockedServerStoreReadOnly.ts";
import { ServerConfigStore } from "$/models/ServerConfig.ts";
import { HttpClientService } from "$/services/HttpClientService.ts";
import { JsonLdService } from "$/services/JsonLdService.ts";
import { CONTENT_TYPE, defaultContext } from "$/schemas/activitypub/mod.ts";
import * as urls from "$/lib/urls.ts";
import { log } from "$/deps.ts";

export enum Priority {
  Optional,
  Eventually,
  Soon,
  Immediate,
}

@InjectableAbstract()
export abstract class ActivityDispatcher {
  abstract dispatch(
    activity: Activity,
    priority: Priority,
    onComplete?: () => void,
  ): Promise<void>;

  abstract request(
    url: URL,
    fromPersona: string,
    priority: Priority,
  ): Promise<Object>;

  abstract dispatchTo(
    url: URL,
    activity: Activity,
    fromPersona: string,
  ): Promise<Response>;
}

@Singleton(ActivityDispatcher)
export class ActivityDispatcherImpl extends ActivityDispatcher {
  private readonly serverConfig;

  constructor(
    private readonly httpClient: HttpClientService,
    private readonly jsonLd: JsonLdService,
    private readonly personaStore: PersonaStoreReadOnly,
    private readonly inFollowStore: InFollowStoreReadOnly,
    private readonly knownServerStore: KnownServerStoreReadOnly,
    private readonly blockedServerStore: BlockedServerStoreReadOnly,
    serverConfigStore: ServerConfigStore,
  ) {
    super();
    this.serverConfig = serverConfigStore.getServerConfig();
  }

  async dispatch(
    activity: Activity,
    priority: Priority,
    onComplete?: () => void,
  ): Promise<void> {
    const inboxes = new Set<string>(),
      persona = urls.isActivityPubActor(
        typeof activity.actor === "string"
          ? activity.actor
          : (activity.actor as Actor).id,
        (await this.serverConfig).url,
      ),
      to: (string | Actor)[] = Array.isArray(activity.to)
        ? activity.to
        : (activity.to == null ? [] : [activity.to]),
      cc: (string | Actor)[] = Array.isArray(activity.cc)
        ? activity.cc
        : (activity.cc == null ? [] : [activity.cc]);

    if (persona == null) {
      throw new Error(
        `Cannot dispatch activity from actor ${activity.actor}: not a valid persona URL`,
      );
    }

    for (const actor of [...to, ...cc]) {
      let actorJson: Actor;
      if (typeof actor === "string") {
        if (actor === key.Public) {
          for (const inbox of await this.knownServerStore.sharedInboxes()) {
            inboxes.add(inbox);
          }
          continue;
        }
        const followers = urls.isActivityPubFollowers(
          actor,
          (await this.serverConfig).url,
        );
        if (followers) {
          for (
            const inbox of await this.inFollowStore.listFollowerInboxes(
              followers,
            )
          ) {
            inboxes.add(inbox);
          }
          continue;
        }
        const json = await this.request(new URL(actor), persona, priority);
        if (isActor(json)) {
          actorJson = json;
        } else {
          log.warning(`Cannot get inbox for actor ${JSON.stringify(actor)}:`);
          continue;
        }
      } else {
        actorJson = actor;
      }
      inboxes.add(actorJson.inbox);
    }

    for (const inbox of inboxes) {
      try {
        const rsp = await this.dispatchTo(new URL(inbox), activity, persona);
        if (!rsp.ok) {
          log.error(
            `Activity dispatch to ${inbox} failed: HTTP ${rsp.status} ${rsp.statusText}, ${rsp.text()}`,
          );
        }
      } catch (e) {
        log.error(`Activity dispatch to ${inbox} failed: ${e?.message ?? e}`);
      }
    }
    onComplete?.();
  }

  async dispatchTo(
    url: URL,
    activity: Activity,
    fromPersona: string,
  ): Promise<Response> {
    if (await this.blockedServerStore.blocksActivityUrl(url)) {
      throw new Error("URL is blocked");
    }
    const req = new Request(url, {
        method: "POST",
        body: JSON.stringify({ "@context": defaultContext, ...activity }),
        headers: {
          "content-type": CONTENT_TYPE,
          "accept": CONTENT_TYPE,
        },
      }),
      serverConfig = await this.serverConfig,
      signedReq = await signRequest(
        req,
        `${urls.activityPubActor(fromPersona, serverConfig.url)}#main-key`,
        serverConfig.privateKey,
      );
    log.info(`Dispatching ${activity.type} activity to ${url}`);
    return this.httpClient.fetch(signedReq);
  }

  async request(
    url: URL,
    fromPersona: string,
    _priority: Priority,
  ): Promise<Object> {
    // TODO: Do something with priority
    log.info(`Requesting: ${url}`);
    if (await this.blockedServerStore.blocksActivityUrl(url)) {
      throw new Error(`Cannot request activity data: URL ${url} is blocked`);
    }
    const persona = await this.personaStore.get(fromPersona);
    if (persona == null) {
      throw new Error(
        `Cannot request activity data using nonexistent persona ${
          JSON.stringify(fromPersona)
        }`,
      );
    }
    const req = new Request(url, { headers: { "accept": CONTENT_TYPE } }),
      serverConfig = await this.serverConfig,
      signedReq = await signRequest(
        req,
        `${urls.activityPubActor(fromPersona, serverConfig.url)}#main-key`,
        serverConfig.privateKey,
      ),
      rsp = await this.httpClient.fetch(signedReq);
    if (rsp.ok) {
      const json = await rsp.json(),
        compacted = await this.jsonLd.processDocument({
          ...await this.jsonLd.processDocument(json),
          "@context": defaultContext,
        }, { expandTerms: false });
      if (isObject(compacted)) return compacted;
      throw new Error(
        `ActivityPub request for ${url} returned invalid ActivityPub JSON`,
      );
    } else {
      throw new Error(
        `ActivityPub request for ${url} failed: HTTP ${rsp.status} ${rsp.statusText}, ${rsp.text()}`,
      );
    }
  }
}
