import {
  ColumnOf,
  Columns,
  ColumnsOf,
  ColumnType,
  count,
  createTable,
  DatabaseSpec,
  DB,
  del,
  InRow,
  insert,
  JoinChain,
  JoinQueryBuilder,
  OrderDirection,
  OutRow,
  Query,
  QueryBuilder,
  Schema,
  select,
  TableOf,
  TableSpec,
  update,
} from "$/lib/sql/mod.ts";
import {
  DatabaseService,
  DatabaseServiceFactory,
} from "$/services/DatabaseService.ts";
import { UlidService } from "$/services/UlidService.ts";
import { Constructor, Singleton } from "$/lib/inject.ts";
import { fileExists, mapObject } from "$/lib/utils.ts";
import { log, Sqlite } from "$/deps.ts";

function rowConverter<C extends Columns>(
  spec: TableSpec<C>,
): (r: { [K in keyof C]?: unknown }) => Partial<OutRow<C>> {
  return Object.entries(spec.columns).reduce(
    (last, [k, v]) => {
      switch (v.type) {
        case ColumnType.Date:
          return (r) =>
            last(r[k] != null ? { ...r, [k]: new Date(r[k] as string) } : r);
        case ColumnType.Json:
          return (r) =>
            last(r[k] != null ? { ...r, [k]: JSON.parse(r[k] as string) } : r);
        default:
          return last;
      }
    },
    (r: { [K in keyof C]?: unknown }) => r,
  ) as (r: { [K in keyof C]?: unknown }) => Partial<OutRow<C>>;
}

class SqliteDB<Spec extends DatabaseSpec> extends DatabaseService<Spec> {
  constructor(
    private readonly spec: Spec,
    private readonly ulid: UlidService,
    private readonly convertRow: {
      [T in TableOf<Spec>]: (
        r: { [K in ColumnOf<Spec, T>]?: unknown },
      ) => Partial<OutRow<ColumnsOf<Spec, T>>>;
    },
    private dbPromise: Promise<Sqlite>,
  ) {
    super();
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

  async *get<T extends TableOf<Spec>>(table: T, options: {
    returning?: ColumnOf<Spec, T>[];
    where?: Query<ColumnsOf<Spec, T>>;
    orderBy?: [ColumnOf<Spec, T>, OrderDirection][];
    limit?: number;
  }): AsyncIterable<any> {
    const db = await this.dbPromise,
      { text, values } = select(
        table,
        "sqlite3",
        options.where,
        options.orderBy,
        options.returning,
        options.limit,
      );
    for (
      const row of db.queryEntries<{ [K in ColumnOf<Spec, T>]: unknown }>(
        text,
        values,
      )
    ) {
      yield this.convertRow[table](row);
    }
  }

  join<T extends TableOf<Spec>>(options: {
    table: T;
    returning: ColumnOf<Spec, T>[];
    where?: Query<ColumnsOf<Spec, T>>;
    orderBy?: [ColumnOf<Spec, T>, OrderDirection][];
  }): JoinChain<Spec, T, any> {
    const dbPromise = this.dbPromise,
      convertRow = this.convertRow[options.table];
    return new JoinQueryBuilder<Spec, T>(
      "sqlite3",
      options,
      async function* ({ text, values }) {
        const db = await dbPromise;
        for (
          const row of db.queryEntries<{ [K in ColumnOf<Spec, T>]: unknown }>(
            text,
            values,
          )
        ) {
          yield convertRow(row);
        }
      },
    );
  }

  async count<T extends TableOf<Spec>>(
    table: T,
    where: Query<ColumnsOf<Spec, T>>,
  ): Promise<number> {
    const db = await this.dbPromise,
      { text, values } = count(table, "sqlite3", where);
    return db.query(text, values)[0][0] as number;
  }

  async insert<T extends TableOf<Spec>>(
    table: T,
    rows: InRow<ColumnsOf<Spec, T>>[],
  ): Promise<void> {
    const db = await this.dbPromise,
      { text, values } = insert(
        table,
        "sqlite3",
        this.spec.tables[table],
        rows,
        this.ulid,
      );
    db.query(text, values);
  }

  async update<T extends TableOf<Spec>>(
    table: T,
    where: Query<ColumnsOf<Spec, T>>,
    fields: Partial<InRow<ColumnsOf<Spec, T>>>,
  ): Promise<number> {
    const db = await this.dbPromise,
      { text, values } = update(
        table,
        "sqlite3",
        this.spec.tables[table],
        where,
        fields,
      ),
      rows = db.query(text, values);
    return rows.length;
  }

  async delete<T extends TableOf<Spec>>(
    table: T,
    where: Query<ColumnsOf<Spec, T>>,
  ): Promise<number> {
    const db = await this.dbPromise,
      { text, values } = del(table, "sqlite3", where),
      rows = db.query(text, values);
    return rows.length;
  }

  async close() {
    const db = await this.dbPromise;
    db.close();
  }

  async transaction<R>(callback: (t: DB<Spec>) => Promise<R>): Promise<R> {
    const db = await this.dbPromise;
    const promise = callback(
      new SqliteDB(this.spec, this.ulid, this.convertRow, Promise.resolve(db)),
    );
    this.dbPromise = promise.then(() => db, () => db);
    return promise;
  }
}

export abstract class SqliteDatabaseService<Spec extends DatabaseSpec>
  extends SqliteDB<Spec> {
  constructor(
    filename: string,
    overwrite: boolean,
    spec: Spec,
    ulid: UlidService,
  ) {
    super(
      spec,
      ulid,
      mapObject(spec.tables, (_k, v) => rowConverter(v)) as any,
      (async () => {
        if (overwrite) {
          if (await fileExists(filename)) {
            log.warning(
              `Database file ${
                JSON.stringify(filename)
              } already exists and overwrite=true; deleting!`,
            );
            await Deno.remove(filename);
          }
        }
        const db = new Sqlite(filename);
        if (
          db.query(new Schema("sqlite3").hasTable("_version")).length
        ) {
          const { text, values } = new QueryBuilder("_version", "sqlite3")
            .select("version").first().toSQL();
          const foundVersion =
            db.queryEntries<{ version: number }>(text, values)[0].version;
          if (foundVersion !== spec.version) {
            throw new Error(
              `Database version does not match: got ${foundVersion}, expected ${spec.version}, and migrations are not yet supported`,
            );
          }
        } else {
          log.info(
            `Creating new SQLite database at ${
              JSON.stringify(filename)
            } at version ${spec.version}`,
          );
          const schema = new Schema("sqlite3");
          schema.create("_version", (t) => t.integer("version").primary());
          for (const [name, tspec] of Object.entries(spec.tables)) {
            createTable(schema, name, tspec);
          }
          for (const line of schema.query) {
            db.execute(line);
          }
          const { text, values } = new QueryBuilder("_version", "sqlite3")
            .insert([{ version: spec.version }]).toSQL();
          db.query(text, values);
        }
        return db;
      })(),
    );
  }
}

export class SqliteDatabaseServiceFactory extends DatabaseServiceFactory {
  constructor(
    private readonly filename: string,
    private readonly overwrite = false,
  ) {
    super();
  }

  init<Spec extends DatabaseSpec>(
    spec: Spec,
  ): Promise<Constructor<DatabaseService<Spec>>> {
    const filename = this.filename, overwrite = this.overwrite;

    @Singleton()
    class SqliteDatabaseServiceImpl extends SqliteDatabaseService<Spec> {
      constructor(ulid: UlidService) {
        super(filename, overwrite, spec, ulid);
      }
    }
    return Promise.resolve(SqliteDatabaseServiceImpl);
  }
}
