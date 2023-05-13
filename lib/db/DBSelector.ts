import { path } from "$/deps.ts";
import { AbstractDatabaseService, DBFactory } from "$/lib/db/DBFactory.ts";
import { InMemoryDBFactory } from "$/lib/db/InMemoryDB.ts";
import { SqliteDBFactory } from "$/lib/db/SqliteDB.ts";
import { ConditionalResolver, Constructor, Singleton } from "$/lib/inject.ts";
import { DatabaseSpec, Tables } from "$/lib/sql/mod.ts";
import { dirExists } from "$/lib/utils.ts";
import { DatabaseConfig, TapirConfig } from "$/models/TapirConfig.ts";

export function DBSelector<
  Ts extends Tables,
  Service extends AbstractDatabaseService<Ts>,
>(
  getConfig: (config: TapirConfig) => Required<DatabaseConfig>,
  spec: DatabaseSpec<Ts>,
): Constructor<ConditionalResolver<Service>> {
  @Singleton()
  class DBSelectorImpl extends ConditionalResolver<Service> {
    constructor(
      private readonly config: TapirConfig,
    ) {
      super();
    }

    async resolve(): Promise<Constructor<Service>> {
      const dbConfig = getConfig(this.config);
      let factory: DBFactory;
      switch (dbConfig.type) {
        case "inmemory":
          factory = new InMemoryDBFactory();
          break;
        case "sqlite":
          if (!await dirExists(this.config.dataDir)) {
            await Deno.mkdir(this.config.dataDir, { recursive: true });
          }
          factory = new SqliteDBFactory(
            path.join(this.config.dataDir, dbConfig.path),
          );
          break;
      }
      return factory.constructService(spec);
    }

    readonly isSingleton = true;
  }

  return DBSelectorImpl;
}
