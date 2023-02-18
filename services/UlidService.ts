import { monotonicFactory } from "https://esm.sh/ulidx@0.5.0";
import { Singleton } from "$/lib/inject.ts";

@Singleton()
export class UlidService {
  readonly next = monotonicFactory();
}
