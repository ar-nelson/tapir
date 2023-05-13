import { AbstractDatabaseService } from "$/lib/db/DBFactory.ts";
import { InjectableAbstract } from "$/lib/inject.ts";
import { RemoteDatabaseTables } from "$/schemas/tapir/db/remote/mod.ts";

@InjectableAbstract()
export abstract class RemoteDatabaseService
  extends AbstractDatabaseService<RemoteDatabaseTables> {}
