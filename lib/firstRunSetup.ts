import { log, path, toml } from "$/deps.ts";
import { DBSelector } from "$/lib/db/DBSelector.ts";
import { Injector } from "$/lib/inject.ts";
import { RepoSelector } from "$/lib/repo/RepoSelector.ts";
import { checkPersonaName } from "$/lib/utils.ts";
import { InstanceConfigStore } from "$/models/InstanceConfig.ts";
import { PersonaStore } from "$/models/Persona.ts";
import { DEFAULT_CONFIG_FILE_TOML } from "$/models/TapirConfig.ts";
import { localDatabaseSpec } from "$/schemas/tapir/db/local/mod.ts";
import { assertTapirConfig, TapirConfig } from "$/schemas/tapir/TapirConfig.ts";
import { LocalDatabaseService } from "$/services/LocalDatabaseService.ts";
import { LocalRepoService } from "$/services/LocalRepoService.ts";

export function isConfigComplete(
  config: TapirConfig,
): config is Required<TapirConfig> {
  return !!(config.auth && config.dataDir && config.domain && config.instance &&
    config.localDatabase && config.localMedia && config.loggers &&
    config.mainPersona && config.port && config.remoteDatabase &&
    config.remoteMedia && config.url);
}

export async function firstRunSetup(config: Required<TapirConfig>) {
  assertTapirConfig(config, "First-run config failed: bad config object");
  checkPersonaName(config.mainPersona.name);
  if (new URL(config.url).hostname !== config.domain) {
    throw new Error(
      `Domain ${JSON.stringify(config.domain)} and URL ${
        JSON.stringify(config.url)
      } do not match`,
    );
  }

  // Create data directory
  await Deno.mkdir(config.dataDir, { recursive: true });

  // Write config file
  const configPath = path.join(
    config.dataDir,
    DEFAULT_CONFIG_FILE_TOML,
  );
  log.info(`Writing config file ${configPath}`);
  const { mainPersona, auth, instance, ...configToWrite } = config;
  await Deno.writeTextFile(
    configPath,
    toml.stringify(configToWrite),
  );

  // Initialize databases and repos
  const injector = new Injector(
    [
      LocalDatabaseService,
      DBSelector((sc) => sc.localDatabase, localDatabaseSpec),
    ],
    [
      LocalRepoService,
      RepoSelector((sc) => sc.localMedia),
    ],
  );

  // Set login name and password
  log.info("Creating instance config");
  const instanceConfigStore = await injector.resolve(InstanceConfigStore);
  await instanceConfigStore.update({
    ...instance,
    loginName: auth.username,
  });
  await instanceConfigStore.setPassword(auth.password);

  // Create main persona
  log.info(`Creating main persona ${JSON.stringify(mainPersona.name)}`);
  const personaStore = await injector.resolve(PersonaStore);
  await personaStore.create({
    displayName: mainPersona.name,
    summary: "",
    requestToFollow: false,
    ...mainPersona,
  });

  // TODO: Download theme files
}
