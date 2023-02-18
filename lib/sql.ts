import Dex from "https://deno.land/x/dex@1.0.2/mod.ts";
import {
  Columns,
  ColumnSpec,
  ColumnType,
  InRow,
  inToOut,
  Order,
  Query,
  QueryOp,
  TableSpec,
} from "$/services/DatabaseService.ts";
import { UlidService } from "$/services/UlidService.ts";
import { mapObject } from "$/lib/utils.ts";

export interface SqlBuilder {
  schema: {
    createTable(name: string, cb: (table: TableBuilder) => void): Sql;
    dropTable(name: string): Sql;
    dropTableIfExists(name: string): Sql;
    renameTable(old: string, new_: string): Sql;
    hasTable(name: string): Sql;
    alterTable(name: string, cb: (table: TableBuilder) => void): Sql;
  };
  queryBuilder(): QueryBuilder;
}

export interface QueryBuilder extends Sql {
  column(...fields: string[]): QueryBuilder;
  select(field?: string): QueryBuilder;
  from(table: string): QueryBuilder;
  where(fields: Record<string, unknown>): QueryBuilder;
  where(name: string, ...ops: unknown[]): QueryBuilder;
  whereNot(name: string, ...ops: unknown[]): QueryBuilder;
  andWhere(name: string, ...ops: unknown[]): QueryBuilder;
  andWhereNot(name: string, ...ops: unknown[]): QueryBuilder;
  insert(rows: Record<string, unknown>[]): QueryBuilder;
  into(table: string): QueryBuilder;
  delete(table?: string | string[]): QueryBuilder;
  update(fields: Record<string, unknown>): QueryBuilder;
  onConflict(name: string): QueryBuilder;
  merge(): QueryBuilder;
  count(...columns: string[]): QueryBuilder;
  limit(count: number): QueryBuilder;
  offset(count: number): QueryBuilder;
  orderBy(
    column: string,
    direction?: "asc" | "desc",
    nulls?: "first" | "last",
  ): QueryBuilder;
}

export interface TableBuilder {
  increments(name: string): ColumnBuilder;
  integer(name: string): ColumnBuilder;
  float(name: string): ColumnBuilder;
  boolean(name: string): ColumnBuilder;
  string(name: string, length?: number): ColumnBuilder;
  binary(name: string, length?: number): ColumnBuilder;
  text(name: string): ColumnBuilder;
  date(name: string): ColumnBuilder;
  datetime(name: string): ColumnBuilder;
  decimal(name: string, precision: number): ColumnBuilder;
  enum(name: string, values: string[]): ColumnBuilder;
  json(name: string): ColumnBuilder;
  timestamp(name: string): ColumnBuilder;
  index(columns: string[], indexName?: string): void;

  dropColumn(name: string): void;
  dropTimestamps(useCamelCase?: boolean): void;
  dropIndex(columns: string[], indexName?: string): void;
}

export interface ColumnBuilder {
  primary(): ColumnBuilder;
  references(name: string): ColumnBuilder;
  unique(): ColumnBuilder;
  unsigned(): ColumnBuilder;
  nullable(): ColumnBuilder;
  notNullable(): ColumnBuilder;
  defaultTo(value: unknown): ColumnBuilder;
}

export interface Sql {
  toString(): string;
}

export function SqlBuilder(client: "sqlite3" | "postgresql") {
  return Dex(
    client === "sqlite3"
      ? { client: "sqlite3", useNullAsDefault: true }
      : { client },
  );
}

export function createColumn(
  t: TableBuilder,
  name: string,
  col: ColumnSpec<ColumnType>,
): ColumnBuilder {
  let c: ColumnBuilder;
  switch (col.type) {
    case ColumnType.Ulid:
      c = t.string(name, 26);
      break;
    case ColumnType.String:
      c = t.text(name);
      break;
    case ColumnType.Integer:
      c = t.integer(name);
      break;
    case ColumnType.Boolean:
      c = t.boolean(name);
      break;
    case ColumnType.Date:
      c = t.timestamp(name);
      break;
    case ColumnType.Blob:
      c = t.binary(name);
      break;
    case ColumnType.Json:
      c = t.json(name);
      break;
  }
  if (col.nullable) c = c.nullable();
  else c = c.notNullable();
  if (col.default) c = c.defaultTo(col.default);
  return c;
}

export function createTable(
  sql: SqlBuilder,
  name: string,
  table: TableSpec<Columns>,
): string {
  return sql.schema.createTable(name, (t) => {
    for (const [name, col] of Object.entries(table.columns)) {
      const c = createColumn(t, name, col);
      if (name === table.primaryKey) c.primary();
    }
  }).toString();
}

export function queryWhere(
  q: QueryBuilder,
  column: string,
  op: QueryOp,
  value: unknown,
  first = true,
): QueryBuilder {
  switch (op) {
    case QueryOp.Eq:
      if (first) return q.where(column, value);
      else return q.andWhere(column, value);
    case QueryOp.Neq:
      if (first) return q.whereNot(column, value);
      else return q.andWhereNot(column, value);
    case QueryOp.Gt:
      if (first) return q.where(column, ">", value);
      else return q.andWhere(column, ">", value);
    case QueryOp.Gte:
      if (first) return q.where(column, ">=", value);
      else return q.andWhere(column, ">=", value);
    case QueryOp.Lt:
      if (first) return q.where(column, "<", value);
      else return q.andWhere(column, "<", value);
    case QueryOp.Lte:
      if (first) return q.where(column, "<=", value);
      else return q.andWhere(column, "<=", value);
    case QueryOp.Contains:
      if (first) return q.where(column, "like", `%${value}%`);
      else return q.andWhere(column, "like", `%${value}%`);
    case QueryOp.NotContains:
      if (first) return q.whereNot(column, "like", `%${value}%`);
      else return q.andWhereNot(column, "like", `%${value}%`);
  }
}

export function select<C extends Columns>(
  sql: SqlBuilder,
  table: string,
  spec: TableSpec<C>,
  query: Query<C> = {},
  orderBy: [keyof C & string, Order][] = [],
  limit?: number,
): string {
  let q = sql.queryBuilder().select("*").from(table), first = true;
  for (const [name, [op, value]] of Object.entries(query)) {
    q = queryWhere(q, name, op, value, first);
    first = false;
  }
  for (const [name, order] of orderBy) {
    q = q.orderBy(
      name,
      order === Order.Ascending ? "asc" : "desc",
      spec.columns[name].nullable ? "first" : undefined,
    );
  }
  if (limit != null) {
    q = q.limit(limit);
  }
  return q.toString();
}

export function insert<C extends Columns>(
  sql: SqlBuilder,
  table: string,
  spec: TableSpec<C>,
  rows: InRow<C>[],
  ulidService?: UlidService,
): string {
  return sql.queryBuilder()
    .insert(
      rows.map((r) =>
        mapObject(r, (k, v) => inToOut(spec.columns[k], v, true, ulidService))
      ),
    )
    .into(table)
    .toString();
}

export function update<C extends Columns>(
  sql: SqlBuilder,
  table: string,
  spec: TableSpec<C>,
  query: Query<C>,
  fields: Partial<InRow<C>>,
): string {
  let q = sql.queryBuilder().from(table).update(
      mapObject(fields, (k, v) => inToOut(spec.columns[k], v!)),
    ),
    first = true;
  for (const [name, [op, value]] of Object.entries(query)) {
    q = queryWhere(q, name, op, value, first);
    first = false;
  }
  return q.toString();
}

export function del<C extends Columns>(
  sql: SqlBuilder,
  table: string,
  query: Query<C>,
): string {
  let q = sql.queryBuilder().from(table), first = true;
  for (const [name, [op, value]] of Object.entries(query)) {
    q = queryWhere(q, name, op, value, first);
    first = false;
  }
  return q.delete().toString();
}

export function count<C extends Columns>(
  sql: SqlBuilder,
  table: string,
  query: Query<C>,
): string {
  let q = sql.queryBuilder().from(table), first = true;
  for (const [name, [op, value]] of Object.entries(query)) {
    q = queryWhere(q, name, op, value, first);
    first = false;
  }
  return q.count().toString();
}
