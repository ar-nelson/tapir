import { Constructor } from "$/lib/inject.ts";
import { UlidService } from "$/services/UlidService.ts";

export enum ColumnType {
  Ulid,
  String,
  Integer,
  Boolean,
  Date,
  Json,
  Blob,
}

export enum QueryOp {
  Eq,
  Neq,
  Lt,
  Lte,
  Gt,
  Gte,
  Contains,
  NotContains,
}

export enum Order {
  Ascending,
  Descending,
}

export type ColumnTypeInValue<T extends ColumnType> = T extends ColumnType.Ulid
  ? string
  : T extends ColumnType.String ? string
  : T extends ColumnType.Integer ? number
  : T extends ColumnType.Boolean ? boolean
  : T extends ColumnType.Date ? (Date | string)
  : T extends ColumnType.Json ? unknown
  : T extends ColumnType.Blob ? Uint8Array
  : never;

export type ColumnTypeOutValue<T extends ColumnType> = T extends ColumnType.Ulid
  ? string
  : T extends ColumnType.String ? string
  : T extends ColumnType.Integer ? number
  : T extends ColumnType.Boolean ? boolean
  : T extends ColumnType.Date ? Date
  : T extends ColumnType.Json ? unknown
  : T extends ColumnType.Blob ? Uint8Array
  : never;

export interface ColumnSpec<T extends ColumnType> {
  type: T;
  default?: ColumnTypeInValue<T>;
  nullable?: boolean;
}

export type ColumnInValue<S extends ColumnSpec<ColumnType>> =
  S["nullable"] extends true ? ColumnTypeInValue<S["type"]> | null | undefined
    : S["default"] extends undefined
      ? (S["type"] extends ColumnType.Ulid ? string | undefined
        : ColumnTypeInValue<S["type"]>)
    : ColumnTypeInValue<S["type"]> | undefined;

export type ColumnOutValue<S extends ColumnSpec<ColumnType>> =
  S["nullable"] extends true ? ColumnTypeOutValue<S["type"]> | null
    : ColumnTypeOutValue<S["type"]>;

export type Columns = {
  [name: string]: ColumnSpec<ColumnType>;
};

export type TableSpec<C extends Columns> = {
  primaryKey: keyof C;
  columns: C;
};

export type InRow<C extends Columns> = {
  [K in keyof C]: ColumnInValue<C[K]>;
};

export type OutRow<C extends Columns> = {
  [K in keyof C]: ColumnOutValue<C[K]>;
};

export type Query<C extends Columns> = {
  [K in keyof C]?: [QueryOp, ColumnInValue<C[K]>];
};

export type Tables = {
  [name: string]: TableSpec<Columns>;
};

export interface DatabaseSpec {
  tables: Tables;
  version: number;
}

export type PrimaryKey<C extends Columns, Spec extends TableSpec<C>> =
  ColumnTypeOutValue<C[Spec["primaryKey"]]["type"]>;

export function inToOut<C extends ColumnSpec<ColumnType>>(
  spec: C,
  value: ColumnInValue<C>,
  useDefaults = true,
  ulidGenerator?: UlidService,
): ColumnOutValue<C> {
  if (value === undefined) {
    if ("default" in spec && useDefaults) {
      return spec.default as ColumnOutValue<C>;
    } else if (spec.nullable) {
      return null as ColumnOutValue<C>;
    } else if (spec.type === ColumnType.Ulid && useDefaults && ulidGenerator) {
      return ulidGenerator.next() as ColumnOutValue<C>;
    } else {
      throw new TypeError(
        "Unexpected undefined value for non-nullable database column",
      );
    }
  }
  switch (spec.type) {
    case ColumnType.Date:
      if (typeof value === "string") {
        return Date.parse(value) as ColumnOutValue<C>;
      }
      // fall through
    default:
      return value as ColumnOutValue<C>;
  }
}

export type Comparator<C extends ColumnSpec<ColumnType>> = (
  a: ColumnOutValue<C>,
  b: ColumnOutValue<C>,
) => number;

export type RowComparator<C extends Columns> = (
  a: OutRow<C>,
  b: OutRow<C>,
) => number;

export function columnCompare<C extends ColumnSpec<ColumnType>>(
  spec: C,
  order: Order = Order.Ascending,
): Comparator<C> {
  if (spec.nullable) {
    const nonNullable = columnCompare({ ...spec, nullable: false }, order);
    return (a, b) =>
      a == null ? (b == null ? 0 : -1) : b == null ? 1 : nonNullable(a, b);
  }
  let comparator: Comparator<C>;
  switch (spec.type) {
    case ColumnType.Ulid:
    case ColumnType.String:
      comparator = ((a: string, b: string) => a.localeCompare(b)) as Comparator<
        C
      >;
      break;
    case ColumnType.Integer:
      comparator = ((a: number, b: number) => a - b) as Comparator<C>;
      break;
    case ColumnType.Boolean:
      comparator =
        ((a: boolean, b: boolean) => (a ? 1 : 0) - (b ? 1 : 0)) as Comparator<
          C
        >;
      break;
    case ColumnType.Date:
      comparator =
        ((a: Date, b: Date) => a.valueOf() - b.valueOf()) as Comparator<C>;
      break;
    default:
      throw new TypeError(
        "Tried to compare a database column type that is not comparable",
      );
  }
  if (order === Order.Descending) {
    return (a, b) => -comparator(a, b);
  }
  return comparator;
}

export function rowCompare<C extends Columns>(
  spec: C,
  column: keyof C,
  order = Order.Ascending,
): RowComparator<C> {
  const cmp = columnCompare(spec[column], order);
  return (a, b) => cmp(a[column], b[column]);
}

export function columnQuery<C extends ColumnSpec<ColumnType>>(
  spec: C,
  op: QueryOp,
  val: ColumnInValue<C>,
): (actual: ColumnOutValue<C>) => boolean {
  const expected = inToOut(spec, val, false);
  switch (op) {
    case QueryOp.Eq:
      return (actual) => actual === expected;
    case QueryOp.Neq:
      return (actual) => actual !== expected;
    case QueryOp.Contains:
      if (spec.type !== ColumnType.String) {
        throw new TypeError(
          "The Contains query operation is only valid for String columns",
        );
      }
      return (actual) => (actual as string).includes(expected as string);
    case QueryOp.NotContains:
      if (spec.type !== ColumnType.String) {
        throw new TypeError(
          "The NotContains query operation is only valid for String columns",
        );
      }
      return (actual) => !(actual as string).includes(expected as string);
    default: {
      const comparator = columnCompare(spec);
      switch (op) {
        case QueryOp.Lt:
          return (actual) => comparator(actual, expected) < 0;
        case QueryOp.Lte:
          return (actual) => comparator(actual, expected) <= 0;
        case QueryOp.Gt:
          return (actual) => comparator(actual, expected) > 0;
        case QueryOp.Gte:
          return (actual) => comparator(actual, expected) >= 0;
      }
    }
  }
}

export function rowQuery<C extends Columns>(spec: C, query: Query<C>) {
  return (Object.entries(query) as [
    keyof C,
    [QueryOp, ColumnInValue<C[keyof C]>],
  ][]).reduce(
    (fn, [k, [op, val]]) => {
      const c = columnQuery(spec[k], op, val);
      return (row: OutRow<C>) => c(row[k]) && fn(row);
    },
    (_row: OutRow<C>) => true,
  );
}

export interface DatabaseTable<C extends Columns> {
  get(options: {
    where?: Query<C>;
    orderBy?: [keyof C & string, Order][];
    limit?: number;
  }): AsyncIterable<OutRow<C>>;

  count(where: Query<C>): Promise<number>;

  insert(rows: InRow<C>[]): Promise<void>;

  update(
    where: Query<C>,
    fields: Partial<InRow<C>>,
  ): Promise<number>;

  delete(where: Query<C>): Promise<number>;
}

export type ColumnsOf<DB extends DatabaseSpec, K extends keyof DB["tables"]> =
  DB["tables"][K]["columns"];

export abstract class DatabaseServiceFactory {
  abstract init<Spec extends DatabaseSpec>(
    spec: Spec,
  ): Promise<Constructor<DatabaseService<Spec>>>;
}

export abstract class DatabaseService<Spec extends DatabaseSpec> {
  abstract table<K extends keyof Spec["tables"]>(
    name: K,
  ): DatabaseTable<ColumnsOf<Spec, K>>;

  abstract close(): Promise<void>;
}
