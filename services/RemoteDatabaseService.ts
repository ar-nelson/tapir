import { remoteDatabaseSpec } from "$/schemas/tapir/db/remote/mod.ts";
import { InjectableAbstract } from "$/lib/inject.ts";
import { AbstractDatabaseService } from "$/lib/db/DBFactory.ts";

@InjectableAbstract()
export abstract class RemoteDatabaseService
  extends AbstractDatabaseService<typeof remoteDatabaseSpec> {}
