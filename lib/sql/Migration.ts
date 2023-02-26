import { Columns, DatabaseSpec, TableSpec } from "./DB.ts";
import { Schema } from "./Schema.ts";
import { DBDialects } from "./TypeUtils.ts";
import { createColumn, createTable } from "./Queries.ts";

export class InvalidMigration extends Error {
  constructor(message: string) {
    super(message);
  }
}

export function tableMigration(
  schema: Schema,
  tableName: string,
  from: TableSpec<Columns>,
  to: TableSpec<Columns>,
): string[] {
  if (from.primaryKey !== to.primaryKey) {
    if (to.columns[to.primaryKey].renamedFrom !== from.primaryKey) {
      throw new InvalidMigration(
        `Can't change primary key of table ${tableName} (from ${from.primaryKey} to ${to.primaryKey}}`,
      );
    }
  }
  return schema.alter(tableName, (table) => {
    const migratedColumns = new Set<string>();
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
  });
}

export function schemaMigration(
  dialect: DBDialects,
  from: DatabaseSpec,
  to: DatabaseSpec,
): string[] {
  if (from.version >= to.version) {
    throw new InvalidMigration(
      `Cannot migrate from version ${from.version} to version ${to.version}`,
    );
  }
  const schema = new Schema(dialect), migratedTables = new Set<string>();
  for (const [toName, toSpec] of Object.entries(to.tables)) {
    const fromName = toSpec.renamedFrom ?? toName,
      fromSpec = from.tables[fromName];
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
  for (const fromName of Object.keys(from.tables)) {
    if (!migratedTables.has(fromName)) {
      schema.drop(fromName);
    }
  }
  return schema.query;
}
