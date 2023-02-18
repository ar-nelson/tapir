import {
  Columns,
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
import * as sql from "$/lib/sql.ts";
import type { SqlBuilder } from "$/lib/sql.ts";
import * as log from "https://deno.land/std@0.176.0/log/mod.ts";

export class SqliteDatabaseTable<C extends Columns, Spec extends TableSpec<C>>
  implements DatabaseTable<C> {
  constructor(
    private readonly name: string,
    private readonly spec: Spec,
    private readonly sql: SqlBuilder,
    private readonly db: Sqlite,
    private readonly ulid: UlidService,
  ) {}

  async *get(
    this: SqliteDatabaseTable<C, Spec>,
    options: {
      where?: Query<C>;
      orderBy?: [keyof C & string, Order][];
      limit?: number;
    },
  ): AsyncIterable<OutRow<C>> {
    const query = sql.select(
      this.sql,
      this.name,
      this.spec,
      options.where,
      options.orderBy,
      options.limit,
    );
    for (const row of this.db.queryEntries<OutRow<C>>(query)) {
      yield row;
    }
  }

  count(where: Query<C>): Promise<number> {
    return Promise.resolve(
      this.db.queryEntries<{ count: number }>(
        sql.count(this.sql, this.name, where),
      )[0]["count"],
    );
  }

  insert(rows: InRow<C>[]): Promise<void> {
    this.db.query(sql.insert(this.sql, this.name, this.spec, rows, this.ulid));
    return Promise.resolve();
  }

  update(where: Query<C>, fields: Partial<InRow<C>>): Promise<number> {
    const rows = this.db.query(
      sql.update(this.sql, this.name, this.spec, where, fields),
    );
    return Promise.resolve(rows.length);
  }

  delete(where: Query<C>): Promise<number> {
    const rows = this.db.query(sql.del(this.sql, this.name, where));
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
      private readonly sql: SqlBuilder;

      constructor(private readonly ulid: UlidService) {
        super();
        if (overwrite) {
          const stat = Deno.statSync(filename);
          if (stat.isFile || stat.isSymlink) {
            log.warning(
              `Database file ${
                JSON.stringify(filename)
              } already exists and overwrite=true; deleting!`,
            );
            Deno.removeSync(filename);
          }
        }
        this.sql = sql.SqlBuilder("sqlite3");
        this.db = new Sqlite(filename);
        if (
          this.db.query(this.sql.schema.hasTable("_version").toString()).length
        ) {
          const foundVersion = this.db.queryEntries<{ version: number }>(
            this.sql.queryBuilder().select("version").from("_version").limit(
              1,
            ).toString(),
          )[0].version;
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
          this.db.execute(
            this.sql.schema.createTable(
              "_version",
              (t) => t.integer("version").primary().unique(),
            ).toString(),
          );
          this.db.query(
            this.sql.queryBuilder().insert([{ version }]).into("_version")
              .toString(),
          );
          for (const [name, spec] of Object.entries(specTables)) {
            this.db.execute(sql.createTable(this.sql, name, spec));
          }
        }
      }

      table(name: keyof Spec["tables"]) {
        return new SqliteDatabaseTable(
          name as string,
          specTables[name as keyof typeof specTables],
          this.sql,
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
