import { testDatabaseService } from "./DatabaseServiceTestUtil.ts";
import { InMemoryDatabaseServiceFactory } from "./InMemoryDatabaseService.ts";

testDatabaseService(new InMemoryDatabaseServiceFactory());
