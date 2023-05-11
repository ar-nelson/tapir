import { DatabaseSpec } from "$/lib/sql/mod.ts";

import localDatabaseSpec from "./v5.ts";

export { localDatabaseSpec };
export type LocalDatabaseTables = (typeof localDatabaseSpec) extends
  DatabaseSpec<infer Ts> ? Ts
  : never;
