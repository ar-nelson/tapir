import { UlidService } from "$/services/UlidService.ts";
import { DatabaseValues, Q } from "./Q.ts";
import { JoinType, OrderDirection } from "./QueryBuilder.ts";

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
  readonly type: T;
  readonly default?: ColumnTypeInValue<T>;
  readonly nullable?: boolean;
  readonly autoIncrement?: boolean;
  readonly foreignKey?: string;
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
  readonly [name: string]: ColumnSpec<ColumnType>;
};

export type TableSpec<C extends Columns> = {
  readonly primaryKey: keyof C & string;
  readonly columns: C;
  readonly indexes?:
    readonly ((keyof C & string) | readonly (keyof C & string)[])[];
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
  readonly [name: string]: TableSpec<Columns>;
};

export type PrimaryKey<Ts extends Tables, T extends TableOf<Ts>> =
  ColumnTypeOutValue<
    Ts[T]["columns"][Ts[T]["primaryKey"]]["type"]
  >;

export type TableOf<Ts extends Tables> = keyof Ts & string;

export type ColumnsOf<Ts extends Tables, K extends TableOf<Ts>> =
  Ts[K]["columns"];

export type ColumnOf<Ts extends Tables, K extends TableOf<Ts>> =
  & keyof ColumnsOf<Ts, K>
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
  Ts extends Tables,
  FromTables extends TableOf<Ts>,
  Result extends Record<string, unknown>,
> {
  on<
    LT extends FromTables,
    RT extends TableOf<Ts>,
    Returned extends ColumnOf<Ts, RT>,
  >(options: {
    type: JoinType;
    fromTable: LT;
    fromColumn: ColumnOf<Ts, LT>;
    table: RT;
    column: ColumnOf<Ts, RT>;
    returning: Returned[];
    where?: Query<ColumnsOf<Ts, RT>>;
    orderBy?: [ColumnOf<Ts, RT>, OrderDirection][];
  }): JoinChain<
    Ts,
    FromTables | RT,
    Result & Pick<OutRow<ColumnsOf<Ts, RT>>, Returned>
  >;

  get(options?: { limit?: number }): AsyncIterable<Result>;
}

export interface DBLike<Ts extends Tables> {
  get<T extends TableOf<Ts>>(table: T, options?: {
    where?: Query<ColumnsOf<Ts, T>>;
    orderBy?: [ColumnOf<Ts, T>, OrderDirection][];
    limit?: number;
  }): AsyncIterable<OutRow<ColumnsOf<Ts, T>>>;

  get<T extends TableOf<Ts>, Returned extends ColumnOf<Ts, T>>(
    table: T,
    options: {
      returning: Returned[];
      where?: Query<ColumnsOf<Ts, T>>;
      orderBy?: [ColumnOf<Ts, T>, OrderDirection][];
      limit?: number;
    },
  ): AsyncIterable<Pick<OutRow<ColumnsOf<Ts, T>>, Returned>>;

  join<T extends TableOf<Ts>, Returned extends ColumnOf<Ts, T>>(options: {
    table: T;
    returning: Returned[];
    where?: Query<ColumnsOf<Ts, T>>;
    orderBy?: [ColumnOf<Ts, T>, OrderDirection][];
  }): JoinChain<Ts, T, Pick<OutRow<ColumnsOf<Ts, T>>, Returned>>;

  count<T extends TableOf<Ts>>(
    table: T,
    where: Query<ColumnsOf<Ts, T>>,
  ): Promise<number>;

  insert<T extends TableOf<Ts>>(
    table: T,
    rows: InRow<ColumnsOf<Ts, T>>[],
  ): Promise<void>;

  insert<T extends TableOf<Ts>, Returned extends ColumnOf<Ts, T>>(
    table: T,
    rows: InRow<ColumnsOf<Ts, T>>[],
    returning: Returned[],
  ): Promise<Pick<OutRow<ColumnsOf<Ts, T>>, Returned>[]>;

  update<T extends TableOf<Ts>>(
    table: T,
    where: Query<ColumnsOf<Ts, T>>,
    fields: Partial<InRow<ColumnsOf<Ts, T>>>,
  ): Promise<number>;

  delete<T extends TableOf<Ts>>(
    table: T,
    where: Query<ColumnsOf<Ts, T>>,
  ): Promise<number>;
}

export interface DB<Ts extends Tables> extends DBLike<Ts> {
  transaction<R>(callback: (t: DBLike<Ts>) => Promise<R>): Promise<R>;

  close(): Promise<void>;
}
