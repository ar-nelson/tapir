import { testDatabaseService } from "./testTemplate.ts";
import { SqliteDBFactory } from "./SqliteDB.ts";

const tempFile = await Deno.makeTempFile({
  prefix: "sqlite-test",
  suffix: ".db",
});
testDatabaseService(new SqliteDBFactory(tempFile, true));
