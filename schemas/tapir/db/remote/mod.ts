import { DatabaseSpec } from "$/lib/sql/mod.ts";

import v1 from "./v1.ts";

export const remoteDatabaseSpecVersions: DatabaseSpec[] = [v1];
export const remoteDatabaseSpec = v1;
