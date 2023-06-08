import { Singleton } from "$/lib/inject.ts";
import { InFollowNotFound, InFollowStore } from "$/models/InFollow.ts";
import { InFollow, ProtoAddr } from "$/models/types.ts";
import { IN_FOLLOWS, MockPersonaName } from "./mock-data.ts";

@Singleton()
export class MockInFollowStore extends InFollowStore {
  async *listFollowers(persona: string): AsyncIterable<InFollow> {
    yield* (IN_FOLLOWS[persona as MockPersonaName] ?? []).filter((f) =>
      !!f.acceptedAt
    );
  }

  async *listRequests(persona: string): AsyncIterable<InFollow> {
    yield* (IN_FOLLOWS[persona as MockPersonaName] ?? []).filter((f) =>
      !f.acceptedAt
    );
  }

  get(
    params: { id: number } | { remoteActivity: string } | {
      remoteProfile: ProtoAddr;
      persona: string;
    },
  ): Promise<InFollow> {
    let follow: InFollow | undefined = undefined;
    if ("id" in params) {
      follow = Object.values(IN_FOLLOWS).flat().find((f) => f.id === params.id);
    } else if ("remoteActivity" in params) {
      follow = Object.values(IN_FOLLOWS).flat().find((f) =>
        f.remoteActivity === params.remoteActivity
      );
    } else {
      follow = (IN_FOLLOWS[params.persona as MockPersonaName] ?? []).find((f) =>
        f.remoteProfile.protocol === params.remoteProfile.protocol &&
        f.remoteProfile.path === params.remoteProfile.path
      );
    }
    if (!follow) {
      return Promise.reject(
        InFollowNotFound.error(
          `No mock in-follow with ${JSON.stringify(params)}`,
        ),
      );
    } else return Promise.resolve(follow);
  }

  countFollowers(persona: string): Promise<number> {
    return Promise.resolve(
      (IN_FOLLOWS[persona as MockPersonaName] ?? []).filter((f) =>
        !!f.acceptedAt
      ).length,
    );
  }

  countRequests(persona: string): Promise<number> {
    return Promise.resolve(
      (IN_FOLLOWS[persona as MockPersonaName] ?? []).filter((f) =>
        !f.acceptedAt
      ).length,
    );
  }

  create(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  accept(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  reject(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  delete(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  deleteAllForPersona(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  onChange(): void {
    // Do nothing
  }
}
