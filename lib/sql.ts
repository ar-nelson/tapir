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
import * as sql from "$/lib/sql/mod.ts";

export function createColumn(
  t: sql.Table,
  name: string,
  col: ColumnSpec<ColumnType>,
): sql.Column {
  let c: sql.Column;
  switch (col.type) {
    case ColumnType.Ulid:
      c = t.binary(name);
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
  if (col.default) c = c.default(col.default);
  return c;
}

export function createTable(
  schema: sql.Schema,
  name: string,
  table: TableSpec<Columns>,
): string[] {
  return schema.create(name, (t) => {
    for (const [name, col] of Object.entries(table.columns)) {
      const c = createColumn(t, name, col);
      if (name === table.primaryKey) c.primary();
    }
  });
}

export function queryWhere(
  q: sql.QueryBuilder,
  column: string,
  op: QueryOp,
  value: sql.DatabaseValues,
): sql.QueryBuilder {
  switch (op) {
    case QueryOp.Eq:
      return q.where(column, value);
    case QueryOp.Neq:
      return q.not(column, value);
    case QueryOp.Gt:
      return q.where(column, new sql.Q(sql.QueryOperator.GreaterThan, value));
    case QueryOp.Gte:
      return q.where(
        column,
        new sql.Q(sql.QueryOperator.GreaterThanEqual, value),
      );
    case QueryOp.Lt:
      return q.where(column, new sql.Q(sql.QueryOperator.LowerThan, value));
    case QueryOp.Lte:
      return q.where(
        column,
        new sql.Q(sql.QueryOperator.LowerThanEqual, value),
      );
    case QueryOp.Contains:
      return q.where(column, new sql.Q(sql.QueryOperator.In, value));
    case QueryOp.NotContains:
      return q.where(column, new sql.Q(sql.QueryOperator.NotIn, value));
  }
}

export function select<C extends Columns>(
  table: string,
  dialect: sql.DBDialects,
  query: Query<C> = {},
  orderBy: [keyof C & string, Order][] = [],
  limit?: number,
): { text: string; values: sql.DatabaseValues[] } {
  let q = new sql.QueryBuilder(table, dialect).select("*");
  for (const [name, [op, value]] of Object.entries(query)) {
    q = queryWhere(
      q,
      name,
      op,
      value,
    );
  }
  for (const [name, order] of orderBy) {
    q = q.order(
      name,
      order === Order.Ascending ? "ASC" : "DESC",
    );
  }
  if (limit != null) {
    q = q.limit(limit);
  }
  return q.toSQL();
}

export function insert<C extends Columns>(
  table: string,
  dialect: sql.DBDialects,
  spec: TableSpec<C>,
  rows: InRow<C>[],
  ulidService?: UlidService,
): { text: string; values: sql.DatabaseValues[] } {
  return new sql.QueryBuilder(table, dialect).insert(
    rows.map((r) =>
      mapObject(r, (k, v) => inToOut(spec.columns[k], v, true, ulidService))
    ),
  ).toSQL();
}

export function update<C extends Columns>(
  table: string,
  dialect: sql.DBDialects,
  spec: TableSpec<C>,
  query: Query<C>,
  fields: Partial<InRow<C>>,
): { text: string; values: sql.DatabaseValues[] } {
  let q = new sql.QueryBuilder(table, dialect).update(
    mapObject(fields, (k, v) => inToOut(spec.columns[k], v!)),
  );
  for (const [name, [op, value]] of Object.entries(query)) {
    q = queryWhere(
      q,
      name,
      op,
      value,
    );
  }
  return q.toSQL();
}

export function del<C extends Columns>(
  table: string,
  dialect: sql.DBDialects,
  query: Query<C>,
): { text: string; values: sql.DatabaseValues[] } {
  let q = new sql.QueryBuilder(table, dialect);
  for (const [name, [op, value]] of Object.entries(query)) {
    q = queryWhere(
      q,
      name,
      op,
      value,
    );
  }
  return q.delete().toSQL();
}

export function count<C extends Columns>(
  table: string,
  dialect: sql.DBDialects,
  query: Query<C>,
): { text: string; values: sql.DatabaseValues[] } {
  let q = new sql.QueryBuilder(table, dialect);
  for (const [name, [op, value]] of Object.entries(query)) {
    q = queryWhere(
      q,
      name,
      op,
      value,
    );
  }
  return q.count("*").toSQL();
}
