import { mapObject } from "../utils.ts";
import {
  Columns,
  ColumnSpec,
  ColumnType,
  DBLike,
  Tables,
  TableSpec,
} from "./DB.ts";
import { createColumn, createTable } from "./Queries.ts";
import { Schema } from "./Schema.ts";
import { DBDialects } from "./TypeUtils.ts";

export class InvalidMigration extends Error {
  constructor(message: string) {
    super(message);
  }
}

export interface TableDefs extends Tables {
  readonly [name: string]: TableDef<ColumnDefs>;
}

export interface TableDef<C extends ColumnDefs> extends TableSpec<C> {
  readonly renamedFrom?: string;
}

export interface ColumnDefs extends Columns {
  readonly [name: string]: ColumnDef<ColumnType>;
}

export interface ColumnDef<T extends ColumnType> extends ColumnSpec<T> {
  readonly renamedFrom?: string;
}

type TablesFromDefs<Td extends TableDefs> = {
  readonly [K in keyof Td]: TableSpecFromDefs<Td[K]>;
};

interface TableSpecFromDefs<T extends TableSpec<ColumnDefs>>
  extends TableSpec<ColumnDefs> {
  readonly primaryKey: T["primaryKey"];
  readonly columns: ColumnsFromDefs<T["columns"]>;
}

type ColumnsFromDefs<C extends ColumnDefs> = {
  readonly [K in keyof C]: Omit<C[K], "renamedFrom">;
};

export class DatabaseSpec<Ts extends Tables> {
  constructor(
    public readonly version: number,
    public readonly tables: Ts,
  ) {}

  migrate(dialect: DBDialects, fromVersion: number): readonly {
    fromSpec?: DatabaseSpec<Tables>;
    toSpec: DatabaseSpec<Tables>;
    preMigrate?: (db: DBLike<Tables>) => Promise<unknown>;
    postMigrate?: (db: DBLike<Tables>, data: unknown) => Promise<void>;
    sql: string[];
  }[] {
    if (fromVersion >= this.version) return [];
    const sc = new Schema(dialect);
    for (const [name, table] of Object.entries(this.tables)) {
      createTable(sc, name, table);
    }
    return [{ toSpec: this, sql: sc.query }];
  }

  newVersion<Td extends TableDefs>(
    version: number,
    defs: Td,
  ): DatabaseMigration<TablesFromDefs<Td>, Ts> {
    return new DatabaseMigration(this, version, defs as any);
  }
}

export class DatabaseMigration<Ts extends Tables, PreTs extends Tables>
  extends DatabaseSpec<Ts> {
  #preMigrate: (db: DBLike<PreTs>) => Promise<Record<symbol, unknown>> = () =>
    Promise.resolve({});
  #postMigrate: (db: DBLike<Ts>, data: unknown) => Promise<void> = () =>
    Promise.resolve();

  constructor(
    public readonly previous: DatabaseSpec<PreTs>,
    version: number,
    public readonly defs: TableDefs & Ts,
  ) {
    if (previous.version >= version) {
      throw new TypeError(
        `Database spec version ${version} must be greater than ${previous.version}`,
      );
    }
    super(
      version,
      mapObject(
        defs,
        (_k, { primaryKey, indexes, columns }) => ({
          primaryKey,
          indexes,
          columns: mapObject(
            columns,
            (_k, { type, nullable, default: _default, autoIncrement }) => ({
              type,
              nullable,
              default: _default,
              autoIncrement,
            }),
          ),
        }),
      ) as Tables as Ts,
    );
  }

  migrate(dialect: DBDialects, fromVersion: number) {
    if (fromVersion >= this.version) return [];
    const priorMigrations = this.previous.migrate(dialect, fromVersion),
      schema = new Schema(dialect),
      migratedTables = new Set<string>();
    for (const [toName, toSpec] of Object.entries(this.defs)) {
      const fromName = toSpec.renamedFrom ?? toName,
        fromSpec = this.previous.tables[fromName];
      if (fromSpec == null) {
        if (toSpec.renamedFrom) {
          throw new InvalidMigration(
            `Table ${toName} is renamedFrom nonexistent table ${toSpec.renamedFrom}`,
          );
        }
        createTable(schema, toName, toSpec);
      } else {
        migratedTables.add(fromName);
        if (fromName !== toName) {
          schema.renameTable(fromName, toName);
        }
        tableMigration(schema, toName, fromSpec, toSpec);
      }
    }
    for (const fromName of Object.keys(this.previous.tables)) {
      if (!migratedTables.has(fromName)) {
        schema.drop(fromName);
      }
    }
    return [...priorMigrations, {
      fromSpec: this.previous,
      toSpec: this,
      sql: schema.query,
      preMigrate: this.#preMigrate,
      postMigrate: this.#postMigrate,
    }];
  }

  preMigrate(
    fn: (db: DBLike<PreTs>) => Promise<void>,
  ): DatabaseMigration<Ts, PreTs> {
    const oldPreMigrate = this.#preMigrate;
    this.#preMigrate = async (db) => {
      const data = await oldPreMigrate(db);
      await fn(db);
      return data;
    };
    return this;
  }

  postMigrate(
    fn: (db: DBLike<Ts>) => Promise<void>,
  ): DatabaseMigration<Ts, PreTs> {
    const oldPostMigrate = this.#postMigrate;
    this.#postMigrate = async (db, data) => {
      await oldPostMigrate(db, data);
      await fn(db);
    };
    return this;
  }

  prePostMigrate<T>(
    pre: (db: DBLike<PreTs>) => Promise<T>,
    post: (db: DBLike<Ts>, data: T) => Promise<void>,
  ): DatabaseMigration<Ts, PreTs> {
    const oldPreMigrate = this.#preMigrate,
      oldPostMigrate = this.#postMigrate,
      key = Symbol();
    this.#preMigrate = async (db) => {
      const data = await oldPreMigrate(db);
      data[key] = await pre(db);
      return data;
    };
    this.#postMigrate = async (db, data) => {
      await oldPostMigrate(db, data);
      await post(db, (data as Record<symbol, T>)[key]);
    };
    return this;
  }
}

function canonicalizeIndex(index: string | readonly string[]): string {
  if (typeof index === "string") return index;
  return index.toSorted().join(":");
}

export function tableMigration(
  schema: Schema,
  tableName: string,
  from: TableDef<ColumnDefs>,
  to: TableDef<ColumnDefs>,
): string[] {
  if (from.primaryKey !== to.primaryKey) {
    if (to.columns[to.primaryKey].renamedFrom !== from.primaryKey) {
      throw new InvalidMigration(
        `Can't change primary key of table ${tableName} (from ${from.primaryKey} to ${to.primaryKey}}`,
      );
    }
  }
  return schema.alter(tableName, (table) => {
    const migratedColumns = new Set<string>(),
      oldIndexes = new Set((from.indexes ?? []).map(canonicalizeIndex));
    for (const [toName, toCol] of Object.entries(to.columns)) {
      const fromName = toCol.renamedFrom ?? toName,
        fromCol = from.columns[fromName];
      if (fromCol == null) {
        if (toCol.renamedFrom) {
          throw new InvalidMigration(
            `Column ${toName} of table ${tableName} is renamedFrom nonexistent column ${toCol.renamedFrom}`,
          );
        }
        if (!toCol.nullable && !("default" in toCol)) {
          throw new InvalidMigration(
            `Cannot add non-nullable column without a default value (column ${toName} of table ${tableName})`,
          );
        }
        createColumn(table, toName, toCol);
      } else {
        if (
          fromCol.type !== toCol.type || fromCol.nullable !== toCol.nullable ||
          fromCol.default !== toCol.default
        ) {
          throw new InvalidMigration(
            `Cannot change type of column (column ${toName} of table ${tableName})`,
          );
        }
        migratedColumns.add(fromName);
        if (fromName !== toName) {
          table.renameColumn(fromName, toName);
        }
      }
    }
    for (const fromName of Object.keys(from.columns)) {
      if (!migratedColumns.has(fromName)) {
        if (fromName === to.primaryKey) {
          throw new InvalidMigration("Cannot delete primary key");
        }
        table.dropColumn(fromName);
      }
    }
    for (const index of to.indexes ?? []) {
      if (!oldIndexes.has(canonicalizeIndex(index))) {
        table.index(typeof index === "string" ? [index] : index);
      }
    }
    // TODO: Delete old indexes
  });
}
