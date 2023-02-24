import { InjectableAbstract, Singleton } from "$/lib/inject.ts";
import * as urls from "$/lib/urls.ts";
import { Activity, Object } from "$/schemas/activitypub/mod.ts";
import { DatabaseService } from "$/services/DatabaseService.ts";
import { ActivityDispatcher, Priority } from "$/services/ActivityDispatcher.ts";
import { LocalDatabaseSpec } from "$/schemas/tapir/LocalDatabase.ts";
import { ServerConfigStore } from "$/models/ServerConfig.ts";
import { UlidService } from "$/services/UlidService.ts";
import * as log from "https://deno.land/std@0.176.0/log/mod.ts";

export interface LocalActivity {
  readonly id: string;
  readonly json: Activity;
  readonly persona: string;
  readonly sent: boolean;
}

@InjectableAbstract()
export abstract class LocalActivityStore {
  abstract listUnsent(): AsyncIterable<LocalActivity>;

  abstract get(id: string): Promise<LocalActivity | null>;

  abstract getObject(id: string): Promise<Object | null>;

  abstract markSent(id: string): Promise<void>;

  abstract create(json: Omit<Activity, "id">, persona: string): Promise<string>;

  abstract updateObject(
    id: string,
    json: Partial<Omit<Object, "id">>,
  ): Promise<void>;

  abstract delete(id: string): Promise<void>;
}

@Singleton(LocalActivityStore)
export class LocalActivityStoreImpl extends LocalActivityStore {
  private readonly baseUrl;

  constructor(
    private readonly db: DatabaseService<typeof LocalDatabaseSpec>,
    private readonly dispatcher: ActivityDispatcher,
    serverConfigStore: ServerConfigStore,
    private readonly ulid: UlidService,
  ) {
    super();
    this.baseUrl = serverConfigStore.getServerConfig().then((c) => c.url);
    (async () => {
      for await (const { id, json } of this.listUnsent()) {
        log.info(`Redispatching pending ${json.type} message ${id}`);
        this.dispatcher.dispatch(json, Priority.Soon, () => this.markSent(id));
      }
    })();
  }

  async *listUnsent(): AsyncIterable<LocalActivity> {
    yield* this.db.get("activity", { where: { sent: false } });
  }

  async get(id: string): Promise<LocalActivity | null> {
    for await (const p of this.db.get("activity", { where: { id } })) {
      return p;
    }
    return null;
  }

  async getObject(id: string): Promise<Object | null> {
    const activity = await this.get(id);
    if (activity == null || activity.json.object == null) {
      return null;
    }
    const obj = activity.json.object;
    if (typeof obj === "string") {
      const base = urls.activityPubObject("", await this.baseUrl);
      if (obj.startsWith(base)) {
        return this.getObject(obj.slice(base.length));
      }
      return null;
    }
    return obj;
  }

  async markSent(id: string): Promise<void> {
    await this.db.update("activity", { id }, { sent: true });
  }

  async updateObject(
    id: string,
    json: Partial<Omit<Object, "id">>,
  ): Promise<void> {
    const activity = await this.get(id);
    if (activity == null || activity.json.object == null) {
      return;
    }
    const obj = activity.json.object as Object;
    if (
      obj == null || typeof obj !== "object" && Array.isArray(obj)
    ) {
      return;
    }
    const newActivity = {
      ...activity.json,
      object: {
        ...obj,
        ...json,
      },
    };
    await this.db.update("activity", { id }, { json: newActivity });
  }

  async create(json: Omit<Activity, "id">, persona: string): Promise<string> {
    const ulid = this.ulid.next(),
      idUrl = urls.activityPubActivity(ulid, await this.baseUrl),
      activity = { ...json, id: idUrl };
    delete (activity as Record<string, unknown>)["@context"];
    if (activity.type === "Create") {
      const obj = activity.object as Object;
      if (
        obj != null && typeof obj === "object" && !Array.isArray(obj) && !obj.id
      ) {
        activity.object = {
          ...obj,
          id: urls.activityPubObject(ulid, await this.baseUrl),
          ...(obj.type === "Note" || obj.type === "Question")
            ? { url: urls.localPost(ulid, await this.baseUrl) }
            : {},
        };
      }
    }
    await this.db.insert("activity", [{
      id: ulid,
      json: activity,
      sent: false,
      persona,
    }]);
    this.dispatcher.dispatch(
      activity,
      Priority.Soon,
      () => this.markSent(ulid),
    );
    return ulid;
  }

  async delete(id: string): Promise<void> {
    await this.db.delete("activity", { id });
  }
}
