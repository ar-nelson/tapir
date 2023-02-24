import { DatabaseValues, Q } from "./Q.ts";
import { JoinType, OrderDirection } from "./QueryBuilder.ts";
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
  : T extends ColumnType.Json ? any
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
  primaryKey: keyof C & string;
  columns: C;
};

export type InRow<C extends Columns> =
  & {
    [
      K in keyof C & string as C[K]["nullable"] extends true ? K
        : (C[K]["default"] extends undefined ? never : K)
    ]?: ColumnInValue<C[K]>;
  }
  & {
    [
      K in keyof C & string as C[K]["nullable"] extends true ? never
        : (C[K]["default"] extends undefined ? K : never)
    ]: ColumnInValue<C[K]>;
  };

export type OutRow<C extends Columns> = {
  [K in keyof C & string]: ColumnOutValue<C[K]>;
};

export type Query<C extends Columns> = {
  [K in keyof C & string]?:
    | DatabaseValues
    | Q<ColumnInValue<C[K]> & DatabaseValues>;
};

export type Tables = {
  [name: string]: TableSpec<Columns>;
};

export interface DatabaseSpec {
  tables: Tables;
  version: number;
}

export type PrimaryKey<Spec extends DatabaseSpec, T extends TableOf<Spec>> =
  ColumnTypeOutValue<
    Spec["tables"][T]["columns"][Spec["tables"][T]["primaryKey"]]["type"]
  >;

export type TableOf<Spec extends DatabaseSpec> = keyof Spec["tables"] & string;

export type ColumnsOf<Spec extends DatabaseSpec, K extends TableOf<Spec>> =
  Spec["tables"][K]["columns"];

export type ColumnOf<Spec extends DatabaseSpec, K extends TableOf<Spec>> =
  & keyof ColumnsOf<Spec, K>
  & string;

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
    case ColumnType.Json:
      return JSON.stringify(value) as ColumnOutValue<C>;
    case ColumnType.Date:
      if (typeof value === "string") {
        return Date.parse(value) as ColumnOutValue<C>;
      }
      // fall through
    default:
      return value as ColumnOutValue<C>;
  }
}

export interface JoinChain<
  Spec extends DatabaseSpec,
  FromTables extends TableOf<Spec>,
  Result extends Record<string, unknown>,
> {
  on<
    LT extends FromTables,
    RT extends TableOf<Spec>,
    Returned extends ColumnOf<Spec, RT>,
  >(options: {
    type: JoinType;
    fromTable: LT;
    fromColumn: ColumnOf<Spec, LT>;
    table: RT;
    column: ColumnOf<Spec, RT>;
    returning: Returned[];
    where?: Query<ColumnsOf<Spec, RT>>;
    orderBy?: [ColumnOf<Spec, RT>, OrderDirection][];
  }): JoinChain<
    Spec,
    FromTables | RT,
    Result & Pick<OutRow<ColumnsOf<Spec, RT>>, Returned>
  >;

  get(options?: { limit?: number }): AsyncIterable<Result>;
}

export interface DB<Spec extends DatabaseSpec> {
  get<T extends TableOf<Spec>>(table: T, options?: {
    where?: Query<ColumnsOf<Spec, T>>;
    orderBy?: [ColumnOf<Spec, T>, OrderDirection][];
    limit?: number;
  }): AsyncIterable<OutRow<ColumnsOf<Spec, T>>>;

  get<T extends TableOf<Spec>, Returned extends ColumnOf<Spec, T>>(
    table: T,
    options: {
      returning: Returned[];
      where?: Query<ColumnsOf<Spec, T>>;
      orderBy?: [ColumnOf<Spec, T>, OrderDirection][];
      limit?: number;
    },
  ): AsyncIterable<Pick<OutRow<ColumnsOf<Spec, T>>, Returned>>;

  join<T extends TableOf<Spec>, Returned extends ColumnOf<Spec, T>>(options: {
    table: T;
    returning: Returned[];
    where?: Query<ColumnsOf<Spec, T>>;
    orderBy?: [ColumnOf<Spec, T>, OrderDirection][];
  }): JoinChain<Spec, T, Pick<OutRow<ColumnsOf<Spec, T>>, Returned>>;

  count<T extends TableOf<Spec>>(
    table: T,
    where: Query<ColumnsOf<Spec, T>>,
  ): Promise<number>;

  insert<T extends TableOf<Spec>>(
    table: T,
    rows: InRow<ColumnsOf<Spec, T>>[],
  ): Promise<void>;

  update<T extends TableOf<Spec>>(
    table: T,
    where: Query<ColumnsOf<Spec, T>>,
    fields: Partial<InRow<ColumnsOf<Spec, T>>>,
  ): Promise<number>;

  delete<T extends TableOf<Spec>>(
    table: T,
    where: Query<ColumnsOf<Spec, T>>,
  ): Promise<number>;

  transaction<R>(callback: (t: DB<Spec>) => Promise<R>): Promise<R>;
}
