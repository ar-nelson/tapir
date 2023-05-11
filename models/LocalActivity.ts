import { Status } from "$/deps.ts";
import { LogLevels, Tag } from "$/lib/error.ts";
import { InjectableAbstract, Singleton } from "$/lib/inject.ts";
import * as urls from "$/lib/urls.ts";
import { TapirConfig } from "$/models/TapirConfig.ts";
import { Activity, Actor, Object } from "$/schemas/activitypub/mod.ts";
import { LocalDatabaseService } from "$/services/LocalDatabaseService.ts";
import { UlidService } from "$/services/UlidService.ts";

export interface LocalActivity {
  readonly id: string;
  readonly json: Activity;
  readonly persona: string;
}

export const ActivityNotFound = new Tag("Local Activity Not Found", {
  level: LogLevels.WARNING,
  internal: false,
  httpStatus: Status.NotFound,
});
export const BadActivity = new Tag("Bad Activity");
export const CreateActivityFailed = new Tag("Create Activity Failed");
export const UpdateActivityFailed = new Tag("Update Activity Failed");

@InjectableAbstract()
export abstract class LocalActivityStore {
  abstract get(id: string): Promise<LocalActivity>;

  abstract getObject(id: string): Promise<Object>;

  abstract create(
    json: Omit<Activity, "id">,
    ulid?: string,
  ): Promise<LocalActivity>;

  abstract updateObject(
    id: string,
    json: Partial<Omit<Object, "id">>,
  ): Promise<void>;

  abstract delete(id: string): Promise<void>;
}

@Singleton(LocalActivityStore)
export class LocalActivityStoreImpl extends LocalActivityStore {
  constructor(
    private readonly db: LocalDatabaseService,
    private readonly config: TapirConfig,
    private readonly ulid: UlidService,
  ) {
    super();
  }

  async get(id: string) {
    for await (const p of this.db.get("activity", { where: { id } })) {
      return p;
    }
    throw ActivityNotFound.error(`No activity with ID ${id}`);
  }

  async getObject(id: string): Promise<Object> {
    const activity = await this.get(id);
    if (activity.json.object == null) {
      throw ActivityNotFound.error(
        `Activity with ID ${id} has no associated object`,
      );
    }
    const obj = activity.json.object;
    if (typeof obj === "string") {
      const base = urls.activityPubObject("", this.config.url);
      if (obj.startsWith(base)) {
        return this.getObject(obj.slice(base.length));
      }
      throw ActivityNotFound.error(
        `Activity with ID ${id} has no associated object`,
      );
    }
    return obj;
  }

  async updateObject(
    id: string,
    json: Partial<Omit<Object, "id">>,
  ): Promise<void> {
    try {
      const activity = await this.get(id);
      if (activity.json.object == null) {
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
    } catch (e) {
      throw UpdateActivityFailed.wrap(e);
    }
  }

  async create(
    json: Omit<Activity, "id">,
    ulid?: string,
  ): Promise<LocalActivity> {
    try {
      const persona = urls.isActivityPubActor(
        typeof json.actor === "string" ? json.actor : (json.actor as Actor).id,
        this.config.url,
      );

      if (persona == null) {
        throw BadActivity.error(
          `Cannot create activity with actor ${json.actor}: not a valid persona URL`,
        );
      }

      if (!ulid) ulid = this.ulid.next();
      const idUrl = urls.activityPubActivity(ulid, this.config.url),
        activity = { ...json, id: idUrl };
      delete (activity as Record<string, unknown>)["@context"];
      if (activity.type === "Create") {
        const obj = activity.object as Object;
        if (
          obj != null && typeof obj === "object" && !Array.isArray(obj) &&
          !obj.id
        ) {
          activity.object = {
            ...obj,
            id: urls.activityPubObject(ulid, this.config.url),
            ...(obj.type === "Note" || obj.type === "Question")
              ? { url: urls.localPost(ulid, {}, this.config.url) }
              : {},
          };
        }
      }
      const finalActivity = {
        id: ulid,
        json: activity,
        persona,
      };
      await this.db.insert("activity", [finalActivity]);
      return finalActivity;
    } catch (e) {
      throw CreateActivityFailed.wrap(e);
    }
  }

  async delete(id: string): Promise<void> {
    await this.db.delete("activity", { id });
  }
}
