import { Application } from "$/deps.ts";
import { Injector } from "$/lib/inject.ts";
import { LocalDatabaseService } from "$/services/LocalDatabaseService.ts";
import { LocalRepoService } from "$/services/LocalRepoService.ts";
import {
  localDatabaseSpec,
  localDatabaseSpecVersions,
} from "$/schemas/tapir/db/local/mod.ts";
import { DBSelector } from "$/lib/db/DBSelector.ts";
import { RepoSelector } from "$/lib/repo/RepoSelector.ts";
import { TapirRouter } from "$/routes/main.ts";

import logger from "https://deno.land/x/oak_logger/mod.ts";

const app = new Application(),
  injector = new Injector(
    [
      LocalDatabaseService,
      DBSelector(
        (sc) => sc.localDatabase,
        localDatabaseSpec,
        localDatabaseSpecVersions,
        "local.db",
      ),
    ],
    [
      LocalRepoService,
      RepoSelector((sc) => sc.localMedia, "localMedia"),
    ],
  ),
  router = await injector.resolve(TapirRouter);

app.use(logger.logger);
app.use(logger.responseTime);
app.use(router.routes());
app.use(router.allowedMethods());

await app.listen({ port: 8000 });
