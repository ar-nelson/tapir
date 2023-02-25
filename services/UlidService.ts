import { Singleton } from "$/lib/inject.ts";
import { ulidx } from "$/deps.ts";

@Singleton()
export class UlidService {
  readonly next = ulidx.monotonicFactory();
}
