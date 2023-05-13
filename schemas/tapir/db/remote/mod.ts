import { DatabaseSpec } from "$/lib/sql/mod.ts";

import remoteDatabaseSpec from "./v1.ts";

export { remoteDatabaseSpec };
export type RemoteDatabaseTables = (typeof remoteDatabaseSpec) extends
  DatabaseSpec<infer Ts> ? Ts
  : never;
