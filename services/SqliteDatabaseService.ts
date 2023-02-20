import {
  Columns,
  ColumnType,
  DatabaseService,
  DatabaseServiceFactory,
  DatabaseSpec,
  DatabaseTable,
  InRow,
  Order,
  OutRow,
  Query,
  TableSpec,
} from "$/services/DatabaseService.ts";
import { UlidService } from "$/services/UlidService.ts";
import { Constructor, Singleton } from "$/lib/inject.ts";
import { DB as Sqlite } from "https://deno.land/x/sqlite@v3.7.0/mod.ts";
import { fileExistsSync } from "$/lib/utils.ts";
import * as sql from "$/lib/sql.ts";
import { DatabaseValues, QueryBuilder, Schema } from "$/lib/sql/mod.ts";
import * as log from "https://deno.land/std@0.176.0/log/mod.ts";

function rowConverter<C extends Columns>(
  spec: TableSpec<C>,
): (r: Partial<{ [K in keyof C]: unknown }>) => Partial<OutRow<C>> {
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
    (r: Partial<{ [K in keyof C]: unknown }>) => r,
  ) as (r: Partial<{ [K in keyof C]: unknown }>) => Partial<OutRow<C>>;
}

export class SqliteDatabaseTable<C extends Columns, Spec extends TableSpec<C>>
  implements DatabaseTable<C> {
  private readonly convertRow;

  constructor(
    private readonly name: string,
    private readonly spec: Spec,
    private readonly db: Sqlite,
    private readonly ulid: UlidService,
  ) {
    this.convertRow = rowConverter(spec);
  }

  async *get(
    this: SqliteDatabaseTable<C, Spec>,
    options: {
      where?: Query<C>;
      orderBy?: [keyof C & string, Order][];
      limit?: number;
    },
  ): AsyncIterable<OutRow<C>> {
    const { text, values } = sql.select(
      this.name,
      "sqlite3",
      options.where,
      options.orderBy,
      options.limit,
    );
    for (
      const row of this.db.queryEntries<{ [K in keyof C]: DatabaseValues }>(
        text,
        values,
      )
    ) {
      yield this.convertRow(row) as OutRow<C>;
    }
  }

  count(where: Query<C>): Promise<number> {
    const { text, values } = sql.count(this.name, "sqlite3", where);
    return Promise.resolve(
      this.db.queryEntries<{ count: number }>(text, values)[0]["count"],
    );
  }

  insert(rows: InRow<C>[]): Promise<void> {
    const { text, values } = sql.insert(
      this.name,
      "sqlite3",
      this.spec,
      rows,
      this.ulid,
    );
    this.db.query(text, values);
    return Promise.resolve();
  }

  update(where: Query<C>, fields: Partial<InRow<C>>): Promise<number> {
    const { text, values } = sql.update(
        this.name,
        "sqlite3",
        this.spec,
        where,
        fields,
      ),
      rows = this.db.query(text, values);
    return Promise.resolve(rows.length);
  }

  delete(where: Query<C>): Promise<number> {
    const { text, values } = sql.del(this.name, "sqlite3", where),
      rows = this.db.query(text, values);
    return Promise.resolve(rows.length);
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
    { version, tables: specTables }: Spec,
  ): Promise<Constructor<DatabaseService<Spec>>> {
    const filename = this.filename, overwrite = this.overwrite;

    @Singleton()
    class InMemoryDatabaseService extends DatabaseService<Spec> {
      private readonly db: Sqlite;

      constructor(private readonly ulid: UlidService) {
        super();
        if (overwrite) {
          if (fileExistsSync(filename)) {
            log.warning(
              `Database file ${
                JSON.stringify(filename)
              } already exists and overwrite=true; deleting!`,
            );
            Deno.removeSync(filename);
          }
        }
        this.db = new Sqlite(filename);
        if (
          this.db.query(new Schema("sqlite3").hasTable("_version")).length
        ) {
          const { text, values } = new QueryBuilder("_version", "sqlite3")
            .select("version").first().toSQL();
          const foundVersion =
            this.db.queryEntries<{ version: number }>(text, values)[0].version;
          if (foundVersion !== version) {
            throw new Error(
              `Database version does not match: got ${foundVersion}, expected ${version}, and migrations are not yet supported`,
            );
          }
        } else {
          log.info(
            `Creating new SQLite database at ${
              JSON.stringify(filename)
            } at version ${version}`,
          );
          const schema = new Schema("sqlite3");
          schema.create("_version", (t) => t.integer("version").primary());
          for (const [name, spec] of Object.entries(specTables)) {
            sql.createTable(schema, name, spec);
          }
          for (const line of schema.query) {
            this.db.execute(line);
          }
          const { text, values } = new QueryBuilder("_version", "sqlite3")
            .insert([{ version }]).toSQL();
          this.db.query(text, values);
        }
      }

      table(name: keyof Spec["tables"]) {
        return new SqliteDatabaseTable(
          name as string,
          specTables[name as keyof typeof specTables],
          this.db,
          this.ulid,
        );
      }

      close() {
        this.db.close();
        return Promise.resolve();
      }
    }
    return Promise.resolve(InMemoryDatabaseService);
  }
}
