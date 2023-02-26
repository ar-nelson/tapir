import {
  DatabaseConfig,
  ServerConfig,
  ServerConfigStore,
} from "$/models/ServerConfig.ts";
import { DatabaseSpec } from "$/lib/sql/mod.ts";
import { ConditionalResolver, Constructor, Singleton } from "$/lib/inject.ts";
import { AbstractDatabaseService, DBFactory } from "$/lib/db/DBFactory.ts";
import { InMemoryDBFactory } from "$/lib/db/InMemoryDB.ts";
import { SqliteDBFactory } from "$/lib/db/SqliteDB.ts";
import { dirExists } from "$/lib/utils.ts";
import { path } from "$/deps.ts";

export function DBSelector<
  Spec extends DatabaseSpec,
  Service extends AbstractDatabaseService<Spec>,
>(
  getConfig: (serverConfig: ServerConfig) => DatabaseConfig,
  spec: Spec,
  specVersions: readonly DatabaseSpec[],
  sqliteFilename: string,
): Constructor<ConditionalResolver<Service>> {
  @Singleton()
  class DBSelectorImpl extends ConditionalResolver<Service> {
    constructor(
      private readonly serverConfigStore: ServerConfigStore,
    ) {
      super();
    }

    async resolve(): Promise<Constructor<Service>> {
      const serverConfig = await this.serverConfigStore.getServerConfig(),
        dbConfig = getConfig(serverConfig);
      let factory: DBFactory;
      switch (dbConfig.type) {
        case "inmemory":
          factory = new InMemoryDBFactory();
          break;
        case "sqlite":
          if (!await dirExists(serverConfig.dataDir)) {
            await Deno.mkdir(serverConfig.dataDir, { recursive: true });
          }
          factory = new SqliteDBFactory(
            path.join(
              serverConfig.dataDir,
              dbConfig.path ?? sqliteFilename,
            ),
          );
          break;
      }
      return factory.constructService(spec, specVersions);
    }

    readonly isSingleton = true;
  }

  return DBSelectorImpl;
}
