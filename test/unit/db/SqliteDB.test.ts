import { SqliteDBFactory } from "$/lib/db/SqliteDB.ts";
import { testDatabaseService } from "./testTemplate.ts";

const tempFile = await Deno.makeTempFile({
  prefix: "sqlite-test",
  suffix: ".db",
});
testDatabaseService(new SqliteDBFactory(tempFile, true));
