import { InMemoryDBFactory } from "$/lib/db/InMemoryDB.ts";
import { testDatabaseService } from "./testTemplate.ts";

testDatabaseService(new InMemoryDBFactory());
