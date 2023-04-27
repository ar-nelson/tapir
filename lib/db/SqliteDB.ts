// deno-lint-ignore-file no-explicit-any
import { log } from "$/deps.ts";
import { DBFactory } from "$/lib/db/DBFactory.ts";
import { Constructor, Singleton } from "$/lib/inject.ts";
import {
  ColumnOf,
  Columns,
  ColumnsOf,
  ColumnType,
  count,
  createTable,
  DatabaseSpec,
  DB,
  DBLike,
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
  schemaMigration,
  select,
  TableOf,
  TableSpec,
  update,
} from "$/lib/sql/mod.ts";
import { fileExists, mapObject } from "$/lib/utils.ts";
import { UlidService } from "$/services/UlidService.ts";
import { DB as Sqlite } from "sqlite";

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
        case ColumnType.Boolean:
          return (r) => last(r[k] == null ? r : { ...r, [k]: !!r[k] });
        default:
          return last;
      }
    },
    (r: { [K in keyof C]?: unknown }) => r,
  ) as (r: { [K in keyof C]?: unknown }) => Partial<OutRow<C>>;
}

class SqliteDBApi<Spec extends DatabaseSpec> implements DBLike<Spec> {
  constructor(
    protected readonly spec: Spec,
    protected readonly ulid: UlidService,
    protected readonly convertRow: {
      [T in TableOf<Spec>]: (
        r: { [K in ColumnOf<Spec, T>]?: unknown },
      ) => Partial<OutRow<ColumnsOf<Spec, T>>>;
    },
    protected dbPromise: Promise<Sqlite>,
  ) {}

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

  insert<T extends TableOf<Spec>>(
    table: T,
    rows: InRow<ColumnsOf<Spec, T>>[],
  ): Promise<void>;

  insert<T extends TableOf<Spec>, Returned extends ColumnOf<Spec, T>>(
    table: T,
    rows: InRow<ColumnsOf<Spec, T>>[],
    returning: Returned[],
  ): Promise<Pick<OutRow<ColumnsOf<Spec, T>>, Returned>[]>;

  async insert<T extends TableOf<Spec>, Returned extends ColumnOf<Spec, T>>(
    table: T,
    rows: InRow<ColumnsOf<Spec, T>>[],
    returning?: ColumnOf<Spec, T>[],
  ): Promise<void | Pick<OutRow<ColumnsOf<Spec, T>>, Returned>[]> {
    const db = await this.dbPromise,
      { text, values } = insert(
        table,
        "sqlite3",
        this.spec.tables[table],
        rows,
        returning,
        this.ulid,
      );
    return db.queryEntries(text, values).map(
      this.convertRow[table] as any,
    ) as OutRow<
      ColumnsOf<Spec, T>
    >[];
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
}

export abstract class SqliteDB<Spec extends DatabaseSpec>
  extends SqliteDBApi<Spec>
  implements DB<Spec> {
  constructor(
    filename: string,
    overwrite: boolean,
    spec: Spec,
    specVersions: readonly DatabaseSpec[],
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
        let db = new Sqlite(filename);
        if (
          db.query(new Schema("sqlite3").hasTable("_version")).length
        ) {
          const { text, values } = new QueryBuilder("_version", "sqlite3")
            .select("version").first().toSQL();
          const foundVersion =
            db.queryEntries<{ version: number }>(text, values)[0].version;
          if (foundVersion > spec.version) {
            throw new Error(
              `Database version is in the future: got ${foundVersion}, expected ${spec.version}`,
            );
          } else if (foundVersion < spec.version) {
            db = await migrateSqliteDatabase(
              db,
              filename,
              foundVersion,
              specVersions,
              ulid,
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

  async close() {
    const db = await this.dbPromise;
    db.close();
  }

  async transaction<R>(callback: (t: DBLike<Spec>) => Promise<R>): Promise<R> {
    const db = await this.dbPromise;
    const promise = callback(
      new SqliteDBApi(
        this.spec,
        this.ulid,
        this.convertRow,
        Promise.resolve(db),
      ),
    );
    this.dbPromise = promise.then(() => db, () => db);
    return promise;
  }
}

export class SqliteDBFactory extends DBFactory {
  constructor(
    private readonly filename: string,
    private readonly overwrite = false,
  ) {
    super();
  }

  protected construct<Spec extends DatabaseSpec>(
    spec: Spec,
    specVersions: readonly DatabaseSpec[],
  ): Constructor<SqliteDB<Spec>> {
    const { filename, overwrite } = this;
    @Singleton()
    class SqliteDBImpl extends SqliteDB<Spec> {
      constructor(ulid: UlidService) {
        super(filename, overwrite, spec, specVersions, ulid);
      }
    }
    return SqliteDBImpl;
  }
}

async function migrateSqliteDatabase(
  db: Sqlite,
  filename: string,
  currentVersion: number,
  specVersions: readonly DatabaseSpec[],
  ulid: UlidService,
): Promise<Sqlite> {
  db.close();
  const backupFile = filename + ".backup";
  await Deno.copyFile(filename, backupFile);
  db = new Sqlite(filename);
  let lastVersion = currentVersion, nextVersion = currentVersion;

  try {
    const startAt = specVersions.findIndex((s) => s.version === currentVersion);
    if (startAt === -1) {
      throw new Error(
        `Cannot migrate database: no past spec exists for version ${currentVersion}`,
      );
    }
    for (let i = startAt; i < specVersions.length - 1; i++) {
      const from = specVersions[i],
        to = specVersions[i + 1];
      lastVersion = from.version, nextVersion = to.version;
      const postMigrateHooks = await Promise.all(
        Object.values(to.tables).map(async ({ preMigrate, postMigrate }) => {
          let migrateArg: unknown = undefined;
          if (preMigrate) {
            migrateArg = await preMigrate(
              new SqliteDBApi(
                from,
                ulid,
                mapObject(from.tables, (_k, v) => rowConverter(v)) as any,
                Promise.resolve(db),
              ),
            );
          }
          return { migrateArg, postMigrate };
        }),
      );
      const sql = schemaMigration("sqlite3", from, to);
      log.info(
        `RUNNING DATABASE MIGRATION FROM VERSION ${from.version} TO ${to.version}:`,
      );
      for (const line of sql) {
        log.info(line);
        db.execute(line);
      }
      for (const { migrateArg, postMigrate } of postMigrateHooks) {
        if (postMigrate) {
          await postMigrate(
            new SqliteDBApi(
              to,
              ulid,
              mapObject(to.tables, (_k, v) => rowConverter(v)) as any,
              Promise.resolve(db),
            ),
            migrateArg,
          );
        }
      }
      const { text, values } = new QueryBuilder("_version", "sqlite3").where(
        "version",
        from.version,
      ).update({
        version: to.version,
      }).toSQL();
      db.query(text, values);
      log.info("MIGRATION COMPLETE");
    }
    await Deno.remove(backupFile);
  } catch (e) {
    log.critical("!! SQLITE DATABASE MIGRATION FAILED !!");
    log.critical(
      `Migration of ${filename} from v${lastVersion} to v${nextVersion} failed with exception:`,
    );
    log.critical(e);
    db.close();
    await Deno.rename(backupFile, filename);
    log.critical(
      "THIS IS AN UNRECOVERABLE ERROR, but your data has not been lost. The database has been restored to its previous state.",
    );
    log.critical(
      "Please report this error at https://github.com/ar-nelson/tapir/issues",
    );

    Deno.exit(1);
  }

  return db;
}
