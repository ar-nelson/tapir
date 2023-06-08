import { Singleton } from "$/lib/inject.ts";
import { TapirConfig } from "$/models/TapirConfig.ts";
import type { TapirConfig as TapirConfigSchema } from "$/schemas/tapir/TapirConfig.ts";
import { TAPIR_CONFIG } from "./mock-data.ts";

export class MockTapirConfig extends TapirConfig {
  constructor(config: TapirConfigSchema = {}) {
    super({ ...TAPIR_CONFIG, ...config });
  }
}

@Singleton()
export class InjectableMockTapirConfig extends MockTapirConfig {
  constructor() {
    super();
  }
}
