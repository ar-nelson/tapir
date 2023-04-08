import { RepoConfig, TapirConfig } from "$/models/TapirConfig.ts";
import { ConditionalResolver, Constructor, Singleton } from "$/lib/inject.ts";
import { AbstractRepoService, RepoFactory } from "$/lib/repo/RepoFactory.ts";
import { InMemoryRepoFactory } from "$/lib/repo/InMemoryRepo.ts";
import { FileSystemRepoFactory } from "$/lib/repo/FileSystemRepo.ts";
import { dirExists } from "$/lib/utils.ts";
import { path } from "$/deps.ts";

export function RepoSelector<Service extends AbstractRepoService>(
  getConfig: (config: TapirConfig) => Required<RepoConfig>,
): Constructor<ConditionalResolver<Service>> {
  @Singleton()
  class DBSelectorImpl extends ConditionalResolver<Service> {
    constructor(
      private readonly config: TapirConfig,
    ) {
      super();
    }

    async resolve(): Promise<Constructor<Service>> {
      const repoConfig = getConfig(this.config);
      let factory: RepoFactory;
      switch (repoConfig.type) {
        case "inmemory":
          factory = new InMemoryRepoFactory();
          break;
        case "file":
          if (!await dirExists(this.config.dataDir)) {
            await Deno.mkdir(this.config.dataDir, { recursive: true });
          }
          factory = new FileSystemRepoFactory(
            path.join(
              this.config.dataDir,
              repoConfig.path,
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
