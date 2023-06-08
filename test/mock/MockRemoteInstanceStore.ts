import { Singleton } from "$/lib/inject.ts";
import {
  InstanceNotFound,
  RemoteInstance,
  RemoteInstanceStore,
} from "$/models/RemoteInstance.ts";
import { REMOTE_INSTANCES } from "./mock-data.ts";

@Singleton()
export class MockRemoteInstanceStore extends RemoteInstanceStore {
  get(url: URL): Promise<RemoteInstance> {
    const instance =
      (REMOTE_INSTANCES as Record<string, RemoteInstance>)[url.hostname];
    return instance ? Promise.resolve(instance) : Promise.reject(
      InstanceNotFound.error(`No mock instance at domain ${url.hostname}`),
    );
  }

  delete(): Promise<void> {
    throw new Error("Method not implemented.");
  }
}
