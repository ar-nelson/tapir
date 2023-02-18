import { testDatabaseService } from "./DatabaseServiceTestUtil.ts";
import { SqliteDatabaseServiceFactory } from "./SqliteDatabaseService.ts";

const tempFile = await Deno.makeTempFile({
  prefix: "sqlite-test",
  suffix: ".db",
});
testDatabaseService(new SqliteDatabaseServiceFactory(tempFile, true));
