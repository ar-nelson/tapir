import { localDatabaseSpec } from "$/schemas/tapir/db/local/mod.ts";
import { InjectableAbstract } from "$/lib/inject.ts";
import { AbstractDatabaseService } from "$/lib/db/DBFactory.ts";

@InjectableAbstract()
export abstract class LocalDatabaseService
  extends AbstractDatabaseService<typeof localDatabaseSpec> {}
