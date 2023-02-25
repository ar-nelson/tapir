import { ServerConfigStore } from "$/models/ServerConfig.ts";
import { DatabaseSpec } from "$/lib/sql/mod.ts";
import { ConditionalResolver, Constructor, Injectable } from "$/lib/inject.ts";
import { AbstractDatabaseService, DBFactory } from "$/lib/db/DBFactory.ts";
import { InMemoryDBFactory } from "$/lib/db/InMemoryDB.ts";
import { SqliteDBFactory } from "$/lib/db/SqliteDB.ts";
import { dirExists } from "$/lib/utils.ts";
import { path } from "$/deps.ts";

export function DBSelector<
  Spec extends DatabaseSpec,
  Service extends AbstractDatabaseService<Spec>,
>(
  spec: Spec,
  sqliteFilename: string,
): Constructor<ConditionalResolver<Service>> {
  @Injectable()
  class DBSelectorImpl extends ConditionalResolver<Service> {
    constructor(
      private readonly serverConfigStore: ServerConfigStore,
    ) {
      super();
    }

    async resolve(): Promise<Constructor<Service>> {
      const config = await this.serverConfigStore.getServerConfig();
      if (!await dirExists(config.dataDir)) {
        await Deno.mkdir(config.dataDir, { recursive: true });
      }
      let factory: DBFactory;
      switch (config.localDatabase.type) {
        case "inmemory":
          factory = new InMemoryDBFactory();
          break;
        case "sqlite":
          factory = new SqliteDBFactory(
            path.join(
              config.dataDir,
              config.localDatabase.path ?? sqliteFilename,
            ),
          );
          break;
      }
      return factory.constructService(spec);
    }
  }

  return DBSelectorImpl;
}
