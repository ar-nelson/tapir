import { LocalDatabaseSpec } from "$/schemas/tapir/LocalDatabase.ts";
import { InjectableAbstract } from "$/lib/inject.ts";
import { AbstractDatabaseService } from "$/lib/db/DBFactory.ts";

@InjectableAbstract()
export abstract class LocalDatabaseService
  extends AbstractDatabaseService<typeof LocalDatabaseSpec> {}
