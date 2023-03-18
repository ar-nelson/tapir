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
} from "$/lib/sql/mod.ts";
import { DBFactory } from "$/lib/db/DBFactory.ts";
import { UlidService } from "$/services/UlidService.ts";
import { Constructor, Singleton } from "$/lib/inject.ts";
import { mapObject } from "$/lib/utils.ts";
import Loki from "$/lib/loki.js";

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
}

export abstract class InMemoryDB<Spec extends DatabaseSpec>
  implements DB<Spec> {
  private readonly db: Loki;

  constructor(
    private readonly spec: Spec,
    private readonly ulid: UlidService,
  ) {
    this.db = new Loki("InMemoryDB", {
      env: "BROWSER",
      adapter: new Loki.LokiMemoryAdapter(),
    });
    for (const [tableName, table] of Object.entries(spec.tables)) {
      this.db.addCollection(tableName, { indices: [table.primaryKey] });
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
    return Promise.resolve(
      this.db.getCollection(table)
        .chain()
        .find(this.#query(where))
        .count(),
    );
  }

  insert<T extends TableOf<Spec>>(
    tableName: T,
    rows: InRow<ColumnsOf<Spec, T>>[],
  ): Promise<void> {
    const spec = this.spec.tables[tableName] as Spec["tables"][T],
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
    this.db.getCollection(tableName).insert(finalRows);
    return Promise.resolve();
  }

  update<T extends TableOf<Spec>>(
    tableName: T,
    where: Query<ColumnsOf<Spec, T>>,
    fields: Partial<InRow<ColumnsOf<Spec, T>>>,
  ): Promise<number> {
    const spec = this.spec.tables[tableName] as Spec["tables"][T];
    let n = 0;
    this.db.getCollection(tableName).findAndUpdate(
      this.#query(where),
      (row: OutRow<ColumnsOf<Spec, T>>) => {
        n++;
        return {
          ...row,
          ...mapObject(
            fields,
            (k, v) => inToOut(spec.columns[k as ColumnOf<Spec, T>], v),
          ),
        };
      },
    );
    return Promise.resolve(n);
  }

  delete<T extends TableOf<Spec>>(
    tableName: T,
    where: Query<ColumnsOf<Spec, T>>,
  ): Promise<number> {
    this.db.getCollection(tableName).findAndRemove(this.#query(where));
    return Promise.resolve(0); // TODO: Return # of deleted rows
  }

  transaction<R>(callback: (t: DBLike<Spec>) => Promise<R>): Promise<R> {
    // FIXME: this is not safe
    return callback(this);
  }

  close() {
    return Promise.resolve();
  }
}

export class InMemoryDBFactory extends DBFactory {
  protected construct<Spec extends DatabaseSpec>(
    spec: Spec,
  ): Constructor<InMemoryDB<Spec>> {
    @Singleton()
    class InMemoryDBImpl extends InMemoryDB<Spec> {
      constructor(ulid: UlidService) {
        super(spec, ulid);
      }
    }

    return InMemoryDBImpl;
  }
}
