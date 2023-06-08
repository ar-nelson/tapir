import { Singleton } from "$/lib/inject.ts";
import * as urls from "$/lib/urls.ts";
import {
  ActivityNotFound,
  LocalActivity,
  LocalActivityStore,
} from "$/models/LocalActivity.ts";
import type { Object } from "$/schemas/activitypub/mod.ts";
import { assertIsObject } from "$/schemas/activitypub/mod.ts";
import { ActivityPubGeneratorService } from "$/services/ActivityPubGeneratorService.ts";
import { LOCAL_POSTS } from "./mock-data.ts";

@Singleton()
export class MockLocalActivityStore extends LocalActivityStore {
  constructor(private readonly apGen: ActivityPubGeneratorService) {
    super();
  }

  get(id: string): Promise<LocalActivity> {
    const post = Object.values(LOCAL_POSTS).flat().find((p) => p.id === id);
    if (post) {
      let activity = {
        ...this.apGen.localPost(post, []),
        id: urls.activityPubActivity(id),
      };
      if (activity.type === "Create") {
        activity = {
          ...activity,
          object: {
            ...(activity.object as Object),
            id: urls.activityPubObject(id),
          },
        };
      }
      return Promise.resolve({
        id,
        persona: post.persona,
        json: activity,
      });
    } else {
      return Promise.reject(
        ActivityNotFound.error(`No mock activity with ID ${id}`),
      );
    }
  }

  async getObject(id: string): Promise<Object> {
    const object = (await this.get(id)).json.object;
    try {
      assertIsObject(object);
    } catch (e) {
      throw ActivityNotFound.wrap(e);
    }
    return object;
  }

  create(): Promise<LocalActivity> {
    throw new Error("Method not implemented.");
  }

  updateObject(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  delete(): Promise<void> {
    throw new Error("Method not implemented.");
  }
}
