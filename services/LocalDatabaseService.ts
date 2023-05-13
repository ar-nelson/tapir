import { AbstractDatabaseService } from "$/lib/db/DBFactory.ts";
import { InjectableAbstract } from "$/lib/inject.ts";
import { LocalDatabaseTables } from "$/schemas/tapir/db/local/mod.ts";

@InjectableAbstract()
export abstract class LocalDatabaseService
  extends AbstractDatabaseService<LocalDatabaseTables> {}
