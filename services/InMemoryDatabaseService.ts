import {
  columnCompare,
  Columns,
  DatabaseService,
  DatabaseServiceFactory,
  DatabaseSpec,
  DatabaseTable,
  InRow,
  inToOut,
  Order,
  OutRow,
  PrimaryKey,
  Query,
  QueryOp,
  rowQuery,
  TableSpec,
} from "$/services/DatabaseService.ts";
import { Constructor, Singleton } from "$/lib/inject.ts";

function mapObject<T extends Record<string, U>, U, V>(
  obj: T,
  fn: <K extends keyof T>(k: K, v: T[K]) => V,
): { [K in keyof T]: V } {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, fn(k, v as any)]),
  ) as { [K in keyof T]: V };
}

export class InMemoryDatabaseTable<C extends Columns, Spec extends TableSpec<C>>
  implements DatabaseTable<C> {
  constructor(private readonly spec: Spec) {}

  readonly table = new Map<PrimaryKey<C, Spec>, OutRow<C>>();

  private readonly query = function* query(
    this: InMemoryDatabaseTable<C, Spec>,
    where: Query<C>,
  ): Iterable<PrimaryKey<C, Spec>> {
    if (where[this.spec.primaryKey]?.[0] === QueryOp.Eq) {
      const k = where[this.spec.primaryKey]![1] as PrimaryKey<C, Spec>;
      if (
        this.table.has(k) &&
        (Object.keys(where).length === 1 ||
          rowQuery(this.spec.columns, where)(this.table.get(k)!))
      ) {
        yield k;
      }
    } else {
      const query = rowQuery(this.spec.columns, where);
      for (const [k, v] of this.table) {
        if (query(v)) {
          yield k;
        }
      }
    }
  };

  readonly get = async function* get(
    this: InMemoryDatabaseTable<C, Spec>,
    options: {
      where?: Query<C>;
      orderBy?: [keyof C, Order][];
      limit?: number;
    },
  ): AsyncIterable<OutRow<C>> {
    let iter = options.where ? this.query(options.where) : this.table.keys();
    const limit = options.limit ?? Infinity;
    let n = 0;
    if (options.orderBy?.length) {
      const cmp = ([key, ord]: [keyof C, Order]) =>
        columnCompare(this.spec.columns[key], ord);
      iter = [...iter].sort(
        options.orderBy.slice(1).reduce(
          (last, ord) => {
            const nextCmp = cmp(ord);
            return (a, b) => {
              const lastCmp = last(a, b);
              return lastCmp === 0 ? nextCmp(a, b) : lastCmp;
            };
          },
          cmp(options.orderBy[0]),
        ),
      );
    }
    for (const k of iter) {
      if (n++ >= limit) return;
      yield this.table.get(k)!;
    }
  };

  insert(rows: InRow<C>[]): Promise<void> {
    for (const inRow of rows) {
      const row = mapObject(inRow, (k, v) => inToOut(this.spec.columns[k], v));
      this.table.set(row[this.spec.primaryKey] as PrimaryKey<C, Spec>, {
        ...row,
      });
    }
    return Promise.resolve();
  }

  update(
    where: Query<C>,
    fields: Partial<InRow<C>>,
  ): Promise<number> {
    let n = 0;
    for (const k of this.query(where)) {
      this.table.set(k, {
        ...this.table.get(k)!,
        ...mapObject(fields, (k, v) => inToOut(this.spec.columns[k], v!)),
      });
      n++;
    }
    return Promise.resolve(n);
  }

  delete(where: Query<C>): Promise<number> {
    let n = 0;
    for (const k of this.query(where)) {
      this.table.delete(k);
      n++;
    }
    return Promise.resolve(n);
  }
}

export class InMemoryDatabaseServiceFactory extends DatabaseServiceFactory {
  init<Spec extends DatabaseSpec>(
    { tables: specTables }: Spec,
  ): Promise<Constructor<DatabaseService<Spec>>> {
    @Singleton()
    class InMemoryDatabaseService extends DatabaseService<Spec> {
      private readonly tables = mapObject(
        specTables,
        (_k, v) => new InMemoryDatabaseTable(v),
      ) as {
        [K in keyof typeof specTables]: InMemoryDatabaseTable<
          (typeof specTables)[K]["columns"],
          (typeof specTables)[K]
        >;
      };

      table(name: keyof Spec["tables"]) {
        return this.tables[name as keyof typeof specTables];
      }
    }
    return Promise.resolve(InMemoryDatabaseService);
  }
}
