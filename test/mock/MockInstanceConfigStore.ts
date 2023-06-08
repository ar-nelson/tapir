import { Singleton } from "$/lib/inject.ts";
import { InstanceConfigStore } from "$/models/InstanceConfig.ts";
import { INSTANCE_CONFIG } from "./mock-data.ts";

@Singleton()
export class MockInstanceConfigStore extends InstanceConfigStore {
  #config = INSTANCE_CONFIG;

  get() {
    return Promise.resolve(this.#config);
  }

  update() {
    return Promise.reject(
      new Error("update is not implemented in MockInstanceConfigStore"),
    );
  }
}
