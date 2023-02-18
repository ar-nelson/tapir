import {
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
  rowCompare,
  rowQuery,
  TableSpec,
} from "$/services/DatabaseService.ts";
import { UlidService } from "$/services/UlidService.ts";
import { Constructor, Singleton } from "$/lib/inject.ts";
import { mapObject } from "$/lib/utils.ts";

export class InMemoryDatabaseTable<C extends Columns, Spec extends TableSpec<C>>
  implements DatabaseTable<C> {
  constructor(
    private readonly spec: Spec,
    private readonly ulid: UlidService,
  ) {}

  readonly table = new Map<PrimaryKey<C, Spec>, OutRow<C>>();

  private *query(
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
  }

  async *get(
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
      const cmp = ([col, ord]: [keyof C, Order]) =>
        rowCompare(this.spec.columns, col, ord);
      iter = [...iter].sort(
        options.orderBy.reduce(
          (last, ord) => {
            const next = cmp(ord);
            return (a, b) =>
              last(a, b) || next(this.table.get(a)!, this.table.get(b)!);
          },
          (_a: PrimaryKey<C, Spec>, _b: PrimaryKey<C, Spec>) => 0,
        ),
      );
    }
    for (const k of iter) {
      if (n++ >= limit) return;
      yield this.table.get(k)!;
    }
  }

  count(where: Query<C>): Promise<number> {
    let n = 0;
    for (const _ of this.query(where)) {
      n++;
    }
    return Promise.resolve(n);
  }

  insert(rows: InRow<C>[]): Promise<void> {
    for (const inRow of rows) {
      const row = mapObject(
        inRow,
        (k, v) => inToOut(this.spec.columns[k], v, true, this.ulid),
      );
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
      constructor(private readonly ulid: UlidService) {
        super();
      }

      private readonly tables = mapObject(
        specTables,
        (_k, v) => new InMemoryDatabaseTable(v, this.ulid),
      ) as {
        [K in keyof typeof specTables]: InMemoryDatabaseTable<
          (typeof specTables)[K]["columns"],
          (typeof specTables)[K]
        >;
      };

      table(name: keyof Spec["tables"]) {
        return this.tables[name as keyof typeof specTables];
      }

      close() {
        return Promise.resolve();
      }
    }
    return Promise.resolve(InMemoryDatabaseService);
  }
}
