import { Application, log } from "$/deps.ts";
import { logger, responseTime } from "$/lib/oakLogger.ts";
import { TapirConfig } from "$/models/TapirConfig.ts";
import { TapirRouter } from "$/routes/main.ts";
import { MockInjector } from "./mock/MockInjector.ts";

console.log("== TAPIR MOCK SERVER ==\n");
const injector = MockInjector,
  router = await injector.resolve(TapirRouter),
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
