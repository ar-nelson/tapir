import { DBFactory } from "$/lib/db/DBFactory.ts";
import { Constructor, Singleton } from "$/lib/inject.ts";
import Loki from "$/lib/loki.js";
import {
  ColumnOf,
  Columns,
  ColumnsOf,
  DatabaseSpec,
  DatabaseValues,
  DB,
  DBLike,
  InRow,
  inToOut,
  JoinChain,
  OrderDirection,
  OutRow,
  Q,
  Query,
  QueryOperator,
  TableOf,
  Tables,
} from "$/lib/sql/mod.ts";
import { mapObject } from "$/lib/utils.ts";
import { UlidService } from "$/services/UlidService.ts";

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
}

export abstract class InMemoryDB<Ts extends Tables> implements DB<Ts> {
  private readonly db: Loki;

  constructor(
    private readonly spec: DatabaseSpec<Ts>,
    private readonly ulid: UlidService,
  ) {
    this.db = new Loki("InMemoryDB", {
      env: "BROWSER",
      adapter: new Loki.LokiMemoryAdapter(),
    });
    for (const [tableName, table] of Object.entries(spec.tables)) {
      this.db.addCollection(tableName, {
        indices: [table.primaryKey, ...table.indexes ?? []],
      });
    }
  }

  #columnQuery(q: Q<DatabaseValues>): unknown {
    switch (q.operator) {
      case QueryOperator.Null:
        return null;
      case QueryOperator.NotNull:
        return { $ne: null };
      case QueryOperator.Equal:
        return q.value;
      case QueryOperator.NotEqual:
        return { $ne: q.value };
      case QueryOperator.LowerThan:
        return { $lt: q.value };
      case QueryOperator.LowerThanEqual:
        return { $lte: q.value };
      case QueryOperator.GreaterThan:
        return { $gt: q.value };
      case QueryOperator.GreaterThanEqual:
        return { $gte: q.value };
      case QueryOperator.In:
        return { $in: q.value };
      case QueryOperator.NotIn:
        return { $nin: q.value };
      case QueryOperator.Like:
        return {
          $regex: new RegExp(
            `${q.value}`.split("%").map(escapeRegExp).join(".*"),
          ),
        };
      case QueryOperator.Ilike:
        return {
          $regex: new RegExp(
            `${q.value}`.split("%").map(escapeRegExp).join(".*"),
            "i",
          ),
        };
      case QueryOperator.Between:
        return {
          $and: [{ $gte: (q.value as unknown[])[0] }, {
            $lte: (q.value as unknown[])[1],
          }],
        };
      case QueryOperator.NotBetween:
        return {
          $or: [{ $lt: (q.value as unknown[])[0] }, {
            $gt: (q.value as unknown[])[1],
          }],
        };
    }
  }

  #query(where: Query<Columns>) {
    return mapObject(
      where,
      (_k, v) => v instanceof Q ? this.#columnQuery(v) : v,
    );
  }

  get<T extends TableOf<Ts>>(table: T, options?: {
    where?: Query<ColumnsOf<Ts, T>>;
    orderBy?: [keyof ColumnsOf<Ts, T>, OrderDirection][];
    limit?: number;
  }): AsyncIterable<OutRow<ColumnsOf<Ts, T>>>;

  get<
    T extends TableOf<Ts>,
    Returned extends ColumnOf<Ts, T>,
  >(table: T, options: {
    returning: Returned[];
    where?: Query<ColumnsOf<Ts, T>>;
    orderBy?: [ColumnOf<Ts, T>, OrderDirection][];
    limit?: number;
  }): AsyncIterable<Pick<OutRow<ColumnsOf<Ts, T>>, Returned>>;

  async *get<T extends TableOf<Ts>>(tableName: T, options: {
    returning?: ColumnOf<Ts, T>[];
    where?: Query<ColumnsOf<Ts, T>>;
    orderBy?: [ColumnOf<Ts, T>, OrderDirection][];
    limit?: number;
  }): AsyncIterable<any> {
    let query = this.db.getCollection(tableName)
      .chain()
      .find(this.#query(options.where ?? {}), options.limit === 1);
    if (options.orderBy?.length) {
      query = query.compoundsort(
        options.orderBy.map(([k, o]) => [k, o === "DESC"]),
      );
    }
    if (options.limit) {
      query = query.limit(options.limit);
    }
    const fields = options.returning ??
      Object.keys(this.spec.tables[tableName].columns);
    for (const row of query.data()) {
      yield Object.fromEntries(
        Object.entries(row).filter(([key]) => fields.includes(key)),
      );
    }
  }

  join<
    T extends TableOf<Ts>,
    Returned extends ColumnOf<Ts, T>,
  >(options: {
    table: T;
    returning: Returned[];
    where?: Query<ColumnsOf<Ts, T>>;
    orderBy?: [ColumnOf<Ts, T>, OrderDirection][];
  }): JoinChain<Ts, T, Pick<OutRow<ColumnsOf<Ts, T>>, Returned>> {
    throw new Error("join is not yet supported on inmemory db");
  }

  count<T extends TableOf<Ts>>(
    table: T,
    where: Query<ColumnsOf<Ts, T>>,
  ): Promise<number> {
    return Promise.resolve(
      this.db.getCollection(table)
        .chain()
        .find(this.#query(where))
        .count(),
    );
  }

  insert<T extends TableOf<Ts>>(
    tableName: T,
    rows: InRow<ColumnsOf<Ts, T>>[],
  ): Promise<void>;

  insert<T extends TableOf<Ts>, Returned extends ColumnOf<Ts, T>>(
    tableName: T,
    rows: InRow<ColumnsOf<Ts, T>>[],
    returning: Returned[],
  ): Promise<Pick<OutRow<ColumnsOf<Ts, T>>, Returned>[]>;

  insert<T extends TableOf<Ts>, Returned extends ColumnOf<Ts, T>>(
    tableName: T,
    rows: InRow<ColumnsOf<Ts, T>>[],
    returning?: ColumnOf<Ts, T>[],
  ): Promise<void | Pick<OutRow<ColumnsOf<Ts, T>>, Returned>[]> {
    const spec = this.spec.tables[tableName],
      finalRows = rows.map((inRow) =>
        mapObject(
          spec.columns,
          (name, col) =>
            inToOut(
              col,
              (inRow as { [k: string]: unknown })[name],
              true,
              this.ulid,
            ),
        )
      );
    const inserted = this.db.getCollection(tableName).insert(finalRows);
    if (returning) {
      return Promise.resolve(
        inserted.map((i: OutRow<ColumnsOf<Ts, T>>) =>
          Object.fromEntries(
            Object.entries(i).filter(([k]) => returning.includes(k)),
          ) as Pick<OutRow<ColumnsOf<Ts, T>>, Returned>
        ),
      );
    }
    return Promise.resolve();
  }

  update<T extends TableOf<Ts>>(
    tableName: T,
    where: Query<ColumnsOf<Ts, T>>,
    fields: Partial<InRow<ColumnsOf<Ts, T>>>,
  ): Promise<number> {
    const spec = this.spec.tables[tableName];
    let n = 0;
    this.db.getCollection(tableName).findAndUpdate(
      this.#query(where),
      (row: OutRow<ColumnsOf<Ts, T>>) => {
        n++;
        return {
          ...row,
          ...mapObject(
            fields,
            (k, v) => inToOut(spec.columns[k as ColumnOf<Ts, T>], v),
          ),
        };
      },
    );
    return Promise.resolve(n);
  }

  delete<T extends TableOf<Ts>>(
    tableName: T,
    where: Query<ColumnsOf<Ts, T>>,
  ): Promise<number> {
    this.db.getCollection(tableName).findAndRemove(this.#query(where));
    return Promise.resolve(0); // TODO: Return # of deleted rows
  }

  transaction<R>(callback: (t: DBLike<Ts>) => Promise<R>): Promise<R> {
    // FIXME: this is not safe
    return callback(this);
  }

  close() {
    return Promise.resolve();
  }
}

export class InMemoryDBFactory extends DBFactory {
  protected construct<Ts extends Tables>(
    spec: DatabaseSpec<Ts>,
  ): Constructor<InMemoryDB<Ts>> {
    @Singleton()
    class InMemoryDBImpl extends InMemoryDB<Ts> {
      constructor(ulid: UlidService) {
        super(spec, ulid);
      }
    }

    return InMemoryDBImpl;
  }
}
