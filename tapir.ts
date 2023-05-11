import { FirstRunController } from "$/controllers/FirstRunController.ts";
import { Application, base58, log } from "$/deps.ts";
import { DBSelector } from "$/lib/db/DBSelector.ts";
import { firstRunSetup, isConfigComplete } from "$/lib/firstRunSetup.ts";
import { Injector } from "$/lib/inject.ts";
import { logger, responseTime } from "$/lib/oakLogger.ts";
import { RepoSelector } from "$/lib/repo/RepoSelector.ts";
import { InstanceConfigStore } from "$/models/InstanceConfig.ts";
import { PersonaStore } from "$/models/Persona.ts";
import { TapirConfig, TapirConfigFile } from "$/models/TapirConfig.ts";
import buildMeta from "$/resources/buildMeta.json" assert { type: "json" };
import { FirstRunRouter } from "$/routes/firstRun.ts";
import { TapirRouter } from "$/routes/main.ts";
import { localDatabaseSpec } from "$/schemas/tapir/db/local/mod.ts";
import { remoteDatabaseSpec } from "$/schemas/tapir/db/remote/mod.ts";
import { TapirConfig as TapirConfigSchema } from "$/schemas/tapir/TapirConfig.ts";
import { LocalDatabaseService } from "$/services/LocalDatabaseService.ts";
import { LocalRepoService } from "$/services/LocalRepoService.ts";
import { RemoteDatabaseService } from "$/services/RemoteDatabaseService.ts";
import { RemoteRepoService } from "$/services/RemoteRepoService.ts";
import { Command } from "cliffy/command/mod.ts";
import { Secret } from "cliffy/prompt/mod.ts";

// Add some missing injectables
import "$/services/protocol-fetchers/ActivityPubFetcherImpl.ts";
import "$/services/protocol-fetchers/LocalFetcherImpl.ts";

await new Command()
  .name("tapir")
  .version(buildMeta.version)
  .description(
    "Single-user Fediverse server supporting ActivityPub, Mastodon API, and more",
  )
  .helpOption("--help", "Show this help.", { global: true })
  .option(
    "-c, --config <filename:string>",
    "Config file, in JSON or TOML format. If not specified, tries tapir.toml, tapir.json. tapir/tapir.toml, and tapir/tapir.json, in that order.",
    { global: true },
  )
  .action(tapirServer)
  .command("password-reset", "Reset password interactively")
  .action(passwordReset)
  .parse(Deno.args);

function defaultInjector(options: { config?: string }): Injector {
  return new Injector(
    [
      LocalDatabaseService,
      DBSelector(
        (sc) => sc.localDatabase,
        localDatabaseSpec,
      ),
    ],
    [
      LocalRepoService,
      RepoSelector((sc) => sc.localMedia),
    ],
    [
      RemoteDatabaseService,
      DBSelector(
        (sc) => sc.remoteDatabase,
        remoteDatabaseSpec,
      ),
    ],
    [
      RemoteRepoService,
      RepoSelector((sc) => sc.remoteMedia),
    ],
    ...options.config
      ? [[
        TapirConfig,
        class SpecificTapirConfigFile extends TapirConfigFile {
          constructor() {
            super(options.config!);
          }
        },
      ]] as const
      : [],
  );
}

async function tapirServer(options: { config?: string }) {
  console.log(`
                               88
  ,d                           ""
  88
MM88MMM ,adPPYYba, 8b,dPPYba,  88 8b,dPPYba,
  88    ""     \`Y8 88P'    "8a 88 88P'   "Y8
  88    ,adPPPPP88 88       d8 88 88
  88,   88,    ,88 88b,   ,a8" 88 88
  "Y888 \`"8bbdP"Y8 88\`YbbdP"'  88 88
                  88
                  88
`);

  let injector: Injector;
  do {
    injector = defaultInjector(options);
    const tapirConfig = await injector.resolve(TapirConfig);
    let directoryExists = false;
    try {
      directoryExists = (await Deno.stat(tapirConfig.dataDir)).isDirectory;
    } catch {
      /* do nothing - directory does not exist */
    }
    if (!directoryExists) {
      await onFirstRun(tapirConfig);
      continue;
    }
    const instanceConfigStore = await injector.resolve(InstanceConfigStore),
      instanceConfig = await instanceConfigStore.get();
    if (!instanceConfig.initialized) {
      await onFirstRun(tapirConfig);
      continue;
    }
    const personaStore = await injector.resolve(PersonaStore);
    if (!(await personaStore.count())) {
      await onFirstRun(tapirConfig);
      continue;
    }
    break;
  } while (true);

  const router = await injector.resolve(TapirRouter),
    app = new Application(),
    tapirConfig = await injector.resolve(TapirConfig);

  app.use(logger);
  app.use(responseTime);
  app.use(router.routes());
  app.use(router.allowedMethods());

  log.info(
    `Now serving: http://localhost:${tapirConfig.port} (public URL ${tapirConfig.url})`,
  );
  await app.listen({ port: tapirConfig.port });
}

async function onFirstRun(config: TapirConfig) {
  const totalConfig: TapirConfigSchema = {
    ...config.originalConfig,
    domain: config.domain,
    url: config.url,
    port: config.port,
    dataDir: config.dataDir,
    localDatabase: config.localDatabase,
    localMedia: config.localMedia,
    remoteDatabase: config.remoteDatabase,
    remoteMedia: config.remoteMedia,
    loggers: config.loggers,
  };
  if (isConfigComplete(totalConfig)) {
    console.log(`
====== Performing first-run setup from config file... ======
`);
    await firstRunSetup(totalConfig);
    return;
  }
  console.error(
    "Config is incomplete:\n" + JSON.stringify(totalConfig, null, 2),
  );
  const app = new Application(),
    abort = new AbortController(),
    key = base58.encode(crypto.getRandomValues(new Uint8Array(10))),
    controller = new FirstRunController(config, abort),
    router = new FirstRunRouter(controller, key);
  console.log(`
============================================================

  It looks like this is your first time running Tapir!

  To configure your new server, open this URL:

  http://localhost:${config.port}/${key}/firstRun

============================================================
`);
  app.use(router.routes());
  app.use(router.allowedMethods());
  await app.listen({ port: config.port, signal: abort.signal });
  console.log(`
========= First-run setup complete!  Restarting... =========
`);
}

async function passwordReset(options: { config?: string }) {
  const injector = defaultInjector(options);
  console.log(`
=================== TAPIR PASSWORD RESET ===================

This will reset the admin password of the Tapir instance in:

${(await injector.resolve(TapirConfig)).dataDir}
`);
  let password = "", confirm = "";
  do {
    password = await Secret.prompt("New password");
    confirm = await Secret.prompt("Confirm new password");
    if (password.length < 8) {
      console.error("Password must be at least 8 characters.");
    }
    if (password !== confirm) console.error("Passwords do not match.");
  } while (password.length < 8 || password !== confirm);

  console.log("Setting new password...");
  const instanceConfig = await injector.resolve(InstanceConfigStore);
  await instanceConfig.setPassword(password);
  console.log("Password updated!");
}
