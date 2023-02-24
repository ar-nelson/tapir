import {
  ColumnOf,
  ColumnsOf,
  DatabaseSpec,
  DB,
  InRow,
  inToOut,
  JoinChain,
  OrderDirection,
  OutRow,
  PrimaryKey,
  Q,
  Query,
  QueryOperator,
  rowCompare,
  rowQuery,
  TableOf,
} from "$/lib/sql/mod.ts";
import {
  DatabaseService,
  DatabaseServiceFactory,
} from "$/services/DatabaseService.ts";
import { UlidService } from "$/services/UlidService.ts";
import { Constructor, Singleton } from "$/lib/inject.ts";
import { mapObject } from "$/lib/utils.ts";

type TableMapMap<Spec extends DatabaseSpec> = {
  [T in TableOf<Spec>]: Map<
    PrimaryKey<Spec, T>,
    OutRow<ColumnsOf<Spec, T>>
  >;
};

export abstract class InMemoryDatabaseService<Spec extends DatabaseSpec>
  extends DatabaseService<Spec> {
  private readonly tables: TableMapMap<Spec>;

  constructor(
    private readonly spec: Spec,
    private readonly ulid: UlidService,
  ) {
    super();
    this.tables = mapObject(spec.tables, () => new Map()) as TableMapMap<Spec>;
  }

  private *query<T extends TableOf<Spec>>(
    table: T,
    where: Query<Spec["tables"][T]["columns"]>,
  ): Iterable<PrimaryKey<Spec, T>> {
    const pk = this.spec.tables[table].primaryKey,
      wherePk = where[pk];
    if (
      wherePk instanceof Q
        ? wherePk.operator === QueryOperator.Equal
        : pk in where
    ) {
      const k = (wherePk instanceof Q ? wherePk.value : wherePk) as PrimaryKey<
        Spec,
        T
      >;
      if (
        this.tables[table].has(k) &&
        (Object.keys(where).length === 1 ||
          rowQuery(this.spec.tables[table].columns, where)(
            this.tables[table].get(k)!,
          ))
      ) {
        yield k;
      }
    } else {
      const query = rowQuery(this.spec.tables[table].columns, where);
      for (const [k, v] of this.tables[table]) {
        if (query(v)) {
          yield k;
        }
      }
    }
  }

  get<T extends TableOf<Spec>>(table: T, options?: {
    where?: Query<ColumnsOf<Spec, T>>;
    orderBy?: [keyof ColumnsOf<Spec, T>, OrderDirection][];
    limit?: number;
  }): AsyncIterable<OutRow<ColumnsOf<Spec, T>>>;

  get<
    T extends TableOf<Spec>,
    Returned extends ColumnOf<Spec, T>,
  >(table: T, options: {
    returning: Returned[];
    where?: Query<ColumnsOf<Spec, T>>;
    orderBy?: [ColumnOf<Spec, T>, OrderDirection][];
    limit?: number;
  }): AsyncIterable<Pick<OutRow<ColumnsOf<Spec, T>>, Returned>>;

  async *get<T extends TableOf<Spec>>(tableName: T, options: {
    returning?: ColumnOf<Spec, T>[];
    where?: Query<ColumnsOf<Spec, T>>;
    orderBy?: [ColumnOf<Spec, T>, OrderDirection][];
    limit?: number;
  }): AsyncIterable<any> {
    const table = this.tables[tableName];
    let iter = options.where
      ? this.query(tableName, options.where)
      : table.keys();
    const limit = options.limit ?? Infinity;
    let n = 0;
    if (options.orderBy?.length) {
      const cmp = ([col, ord]: [ColumnOf<Spec, T>, OrderDirection]) =>
        rowCompare(this.spec.tables[tableName].columns, col, ord);
      iter = [...iter].sort(
        options.orderBy.reduce(
          (last, ord) => {
            const next = cmp(ord);
            return (a, b) => last(a, b) || next(table.get(a)!, table.get(b)!);
          },
          (_a: PrimaryKey<Spec, T>, _b: PrimaryKey<Spec, T>) => 0,
        ),
      );
    }
    for (const k of iter) {
      if (n++ >= limit) return;
      yield table.get(k)!;
    }
  }

  join<
    T extends TableOf<Spec>,
    Returned extends ColumnOf<Spec, T>,
  >(options: {
    table: T;
    returning: Returned[];
    where?: Query<ColumnsOf<Spec, T>>;
    orderBy?: [ColumnOf<Spec, T>, OrderDirection][];
  }): JoinChain<Spec, T, Pick<OutRow<ColumnsOf<Spec, T>>, Returned>> {
    throw new Error("join is not yet supported on inmemory db");
  }

  count<T extends TableOf<Spec>>(
    table: T,
    where: Query<ColumnsOf<Spec, T>>,
  ): Promise<number> {
    let n = 0;
    for (const _ of this.query(table, where)) {
      n++;
    }
    return Promise.resolve(n);
  }

  insert<T extends TableOf<Spec>>(
    tableName: T,
    rows: InRow<ColumnsOf<Spec, T>>[],
  ): Promise<void> {
    const spec = this.spec.tables[tableName] as Spec["tables"][T],
      table = this.tables[tableName];
    for (const inRow of rows) {
      const row = mapObject(
        spec.columns,
        (name, col) =>
          inToOut(col, (inRow as any)[name], true, this.ulid) as any,
      ) as OutRow<ColumnsOf<Spec, T>>;
      table.set(row[spec.primaryKey] as PrimaryKey<Spec, T>, {
        ...row,
      });
    }
    return Promise.resolve();
  }

  update<T extends TableOf<Spec>>(
    tableName: T,
    where: Query<ColumnsOf<Spec, T>>,
    fields: Partial<InRow<ColumnsOf<Spec, T>>>,
  ): Promise<number> {
    const spec = this.spec.tables[tableName], table = this.tables[tableName];
    let n = 0;
    for (const k of this.query(tableName, where)) {
      table.set(k, {
        ...table.get(k)!,
        ...mapObject(
          fields,
          (k, v) => inToOut(spec.columns[k as ColumnOf<Spec, T>], v as any),
        ),
      });
      n++;
    }
    return Promise.resolve(n);
  }

  delete<T extends TableOf<Spec>>(
    tableName: T,
    where: Query<ColumnsOf<Spec, T>>,
  ): Promise<number> {
    const table = this.tables[tableName];
    let n = 0;
    for (const k of this.query(tableName, where)) {
      table.delete(k);
      n++;
    }
    return Promise.resolve(n);
  }

  transaction<R>(callback: (t: DB<Spec>) => Promise<R>): Promise<R> {
    // FIXME: this is not safe
    return callback(this);
  }

  close() {
    return Promise.resolve();
  }
}

export class InMemoryDatabaseServiceFactory extends DatabaseServiceFactory {
  constructor() {
    super();
  }

  init<Spec extends DatabaseSpec>(
    spec: Spec,
  ): Promise<Constructor<DatabaseService<Spec>>> {
    @Singleton()
    class InMemoryDatabaseServiceImpl extends InMemoryDatabaseService<Spec> {
      constructor(ulid: UlidService) {
        super(spec, ulid);
      }
    }
    return Promise.resolve(InMemoryDatabaseServiceImpl);
  }
}
