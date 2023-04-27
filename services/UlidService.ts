import { Singleton } from "$/lib/inject.ts";
import { monotonicFactory } from "$/lib/ulid.ts";

@Singleton()
export class UlidService {
  readonly next = monotonicFactory();
}
