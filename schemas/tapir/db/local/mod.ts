import { DatabaseSpec } from "$/lib/sql/mod.ts";

import v1 from "./v1.ts";
import v2 from "./v2.ts";
import v3 from "./v3.ts";

export const localDatabaseSpecVersions: DatabaseSpec[] = [v1, v2, v3];
export const localDatabaseSpec = v3;
