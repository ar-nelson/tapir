import { testDatabaseService } from "./testTemplate.ts";
import { InMemoryDBFactory } from "./InMemoryDB.ts";

testDatabaseService(new InMemoryDBFactory());
