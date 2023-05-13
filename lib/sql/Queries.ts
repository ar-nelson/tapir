import { mapObject } from "$/lib/utils.ts";
import { UlidService } from "$/services/UlidService.ts";
import { Column } from "./Column.ts";
import {
  Columns,
  ColumnsOf,
  ColumnSpec,
  ColumnType,
  InRow,
  inToOut,
  JoinChain,
  Query,
  TableOf,
  Tables,
  TableSpec,
} from "./DB.ts";
import { DatabaseValues, Q, QueryOperator } from "./Q.ts";
import { JoinType, OrderDirection, QueryBuilder } from "./QueryBuilder.ts";
import { Schema } from "./Schema.ts";
import { Table } from "./Table.ts";
import { DBDialects } from "./TypeUtils.ts";

export function createColumn(
  t: Table,
  name: string,
  col: ColumnSpec<ColumnType>,
): Column {
  let c: Column;
  switch (col.type) {
    case ColumnType.Ulid:
      c = t.string(name, 26);
      break;
    case ColumnType.String:
      c = t.text(name);
      break;
    case ColumnType.Integer:
      if (col.autoIncrement) c = t.increments(name);
      else c = t.integer(name);
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
  else if (!col.autoIncrement) c = c.notNullable();
  if (col.default != null) c = c.default(col.default);
  return c;
}

export function createTable(
  schema: Schema,
  name: string,
  table: TableSpec<Columns>,
): string[] {
  return schema.create(name, (t) => {
    for (const [name, col] of Object.entries(table.columns)) {
      const c = createColumn(t, name, col);
      if (name === table.primaryKey) c.primary();
    }
    for (const index of table.indexes ?? []) {
      t.index(typeof index === "string" ? [index] : index);
    }
  });
}

export function select<C extends Columns>(
  table: string,
  dialect: DBDialects,
  query: Query<C> = {},
  orderBy: [keyof C & string, OrderDirection][] = [],
  returning?: (keyof C & string)[],
  limit?: number,
): { text: string; values: DatabaseValues[] } {
  let q = new QueryBuilder(table, dialect).select("*");
  for (const [name, op] of Object.entries(query)) {
    q = q.where(name, op instanceof Q ? op : new Q(QueryOperator.Equal, op));
  }
  for (const [name, order] of orderBy) {
    q = q.order(name, order);
  }
  if (returning != null) {
    q = q.returning(...returning);
  }
  if (limit != null) {
    q = q.limit(limit);
  }
  return q.toSQL();
}

export function insert<C extends Columns>(
  table: string,
  dialect: DBDialects,
  spec: TableSpec<C>,
  rows: InRow<C>[],
  returning: (keyof C)[] = [],
  ulidService?: UlidService,
): { text: string; values: DatabaseValues[] } {
  let q = new QueryBuilder(table, dialect).insert(
    rows.map((r) =>
      mapObject(
        r,
        (k: keyof C, v) => {
          if (k in spec.columns) {
            return inToOut(spec.columns[k], v, true, ulidService);
          }
          throw new Error(
            `No such column: ${JSON.stringify(k)} in table ${
              JSON.stringify(table)
            }`,
          );
        },
      )
    ),
  );
  if (returning.length) {
    q = q.returning(...returning as string[]);
  }
  console.log(q.toSQL());
  return q.toSQL();
}

export function update<C extends Columns>(
  table: string,
  dialect: DBDialects,
  spec: TableSpec<C>,
  query: Query<C>,
  fields: Partial<InRow<C>>,
): { text: string; values: DatabaseValues[] } {
  let q = new QueryBuilder(table, dialect).update(
    mapObject(fields, (k: keyof C, v) => inToOut(spec.columns[k], v!)),
  );
  for (const [name, op] of Object.entries(query)) {
    q = q.where(name, op instanceof Q ? op : new Q(QueryOperator.Equal, op));
  }
  return q.toSQL();
}

export function del<C extends Columns>(
  table: string,
  dialect: DBDialects,
  query: Query<C>,
): { text: string; values: DatabaseValues[] } {
  let q = new QueryBuilder(table, dialect);
  for (const [name, op] of Object.entries(query)) {
    q = q.where(name, op instanceof Q ? op : new Q(QueryOperator.Equal, op));
  }
  return q.delete().toSQL();
}

export function count<C extends Columns>(
  table: string,
  dialect: DBDialects,
  query: Query<C>,
): { text: string; values: DatabaseValues[] } {
  let q = new QueryBuilder(table, dialect);
  for (const [name, op] of Object.entries(query)) {
    q = q.where(name, op instanceof Q ? op : new Q(QueryOperator.Equal, op));
  }
  return q.count("*").toSQL();
}

export class JoinQueryBuilder<
  Ts extends Tables,
  T extends TableOf<Ts>,
> implements JoinChain<Ts, T, Record<string, unknown>> {
  private query: QueryBuilder;
  private returning: string[] = [];

  constructor(
    dialect: DBDialects,
    options: {
      table: T;
      returning: (keyof ColumnsOf<Ts, T> & string)[];
      where?: Query<ColumnsOf<Ts, T>>;
      orderBy?: [keyof ColumnsOf<Ts, T> & string, OrderDirection][];
    },
    private readonly execute: (
      sql: { text: string; values: DatabaseValues[] },
    ) => AsyncIterable<Record<string, unknown>>,
  ) {
    this.query = new QueryBuilder(options.table, dialect);
    this.returning.push(
      ...options.returning.map((c) => `${options.table}.${c}`),
    );
    for (const [name, q] of Object.entries(options.where ?? {})) {
      this.query = this.query.where(
        `${options.table}.${name}`,
        q instanceof Q ? q : new Q(QueryOperator.Equal, q),
      );
    }
    for (const [name, dir] of options.orderBy ?? []) {
      this.query = this.query.order(`${options.table}.${name}`, dir);
    }
  }

  on<
    LT extends T,
    RT extends TableOf<Ts>,
    Returned extends keyof ColumnsOf<Ts, RT> & string,
  >(options: {
    type: JoinType;
    fromTable: LT;
    fromColumn: keyof ColumnsOf<Ts, LT> & string;
    table: RT;
    column: keyof ColumnsOf<Ts, RT> & string;
    returning: Returned[];
    where?: Query<ColumnsOf<Ts, RT>>;
    orderBy?: [keyof ColumnsOf<Ts, RT> & string, OrderDirection][];
  }): JoinChain<Ts, any, any> {
    this.returning.push(
      ...options.returning.map((c) => `${options.table}.${c}`),
    );
    this.query = this.query.joinOfType(
      options.type,
      options.table,
      `${options.fromTable}.${options.fromColumn}`,
      `${options.table}.${options.column}`,
    );
    for (const [name, q] of Object.entries(options.where ?? {})) {
      this.query = this.query.where(
        `${options.table}.${name}`,
        q instanceof Q ? q : new Q(QueryOperator.Equal, q),
      );
    }
    for (const [name, dir] of options.orderBy ?? []) {
      this.query = this.query.order(`${options.table}.${name}`, dir);
    }
    return this;
  }

  get(options?: { limit?: number }): AsyncIterable<Record<string, unknown>> {
    this.query = this.query.select(...this.returning);
    if (options?.limit != null) {
      this.query = this.query.limit(options.limit);
    }
    return this.execute(this.query.toSQL());
  }
}
