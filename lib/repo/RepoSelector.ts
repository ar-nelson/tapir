import { Repo } from "./Repo.ts";
import {
  RepoConfig,
  ServerConfig,
  ServerConfigStore,
} from "$/models/ServerConfig.ts";
import { ConditionalResolver, Constructor, Singleton } from "$/lib/inject.ts";
import { AbstractRepoService, RepoFactory } from "$/lib/repo/RepoFactory.ts";
import { InMemoryRepoFactory } from "$/lib/repo/InMemoryRepo.ts";
import { FileSystemRepoFactory } from "$/lib/repo/FileSystemRepo.ts";
import { dirExists } from "$/lib/utils.ts";
import { path } from "$/deps.ts";

export function RepoSelector<Service extends AbstractRepoService>(
  getConfig: (serverConfig: ServerConfig) => RepoConfig,
  fileSystemPath: string,
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
        repoConfig = getConfig(serverConfig);
      let factory: RepoFactory;
      switch (repoConfig.type) {
        case "inmemory":
          factory = new InMemoryRepoFactory();
          break;
        case "file":
          if (!await dirExists(serverConfig.dataDir)) {
            await Deno.mkdir(serverConfig.dataDir, { recursive: true });
          }
          factory = new FileSystemRepoFactory(
            path.join(
              serverConfig.dataDir,
              repoConfig.path ?? fileSystemPath,
            ),
          );
          break;
      }
      return factory.constructService();
    }

    readonly isSingleton = true;
  }

  return DBSelectorImpl;
}
