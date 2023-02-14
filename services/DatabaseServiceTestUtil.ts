import { assertEquals } from "https://deno.land/std@0.176.0/testing/asserts.ts";
import { ulid } from "https://esm.sh/ulidx@0.5.0";
import {
  Columns,
  ColumnType,
  DatabaseService,
  DatabaseServiceFactory,
  DatabaseSpec,
  DatabaseTable,
  Order,
  OutRow,
  Query,
  QueryOp,
  TableSpec,
} from "$/services/DatabaseService.ts";
import { AbstractConstructor, Constructor, Injector } from "$/lib/inject.ts";

const COLUMNS = {
  id: { type: ColumnType.Ulid },
  name: { type: ColumnType.String },
  age: { type: ColumnType.Integer },
} as const;

const TEST_SPEC = {
  version: 1,
  tables: {
    people: {
      primaryKey: "id",
      columns: COLUMNS,
    },
  },
} as const;

async function collect<T>(iter: AsyncIterable<T>): Promise<T[]> {
  const xs: T[] = [];
  for await (const t of iter) {
    xs.push(t);
  }
  return xs;
}

export async function testDatabaseService(
  factory: DatabaseServiceFactory,
  overrides: Map<Constructor | AbstractConstructor, Constructor> = new Map(),
) {
  overrides.set(DatabaseService, await factory.init(TEST_SPEC));

  function newDb(): DatabaseService<typeof TEST_SPEC> {
    const injector = new Injector(overrides);
    return injector.resolve(DatabaseService);
  }

  Deno.test("insert and get one row", async () => {
    const table = newDb().table("people"),
      id = ulid(),
      row = { id, name: "Bob", age: 42 };
    await table.insert([row]);
    assertEquals(await collect(table.get({})), [row]);
    assertEquals(
      await collect(table.get({ where: { id: [QueryOp.Eq, id] } })),
      [row],
    );
    assertEquals(
      await collect(table.get({ where: { name: [QueryOp.Eq, "Bob"] } })),
      [row],
    );
    assertEquals(
      await collect(table.get({ where: { age: [QueryOp.Eq, 42] } })),
      [row],
    );
    assertEquals(
      await collect(
        table.get({
          where: { id: [QueryOp.Eq, id], name: [QueryOp.Eq, "Bob"] },
        }),
      ),
      [row],
    );
    assertEquals(
      await collect(table.get({ where: { id: [QueryOp.Eq, ulid()] } })),
      [],
    );
    assertEquals(
      await collect(
        table.get({
          where: { id: [QueryOp.Eq, ulid()], name: [QueryOp.Eq, "Bob"] },
        }),
      ),
      [],
    );
    assertEquals(
      await collect(
        table.get({
          where: { id: [QueryOp.Eq, id], name: [QueryOp.Eq, "Alice"] },
        }),
      ),
      [],
    );
  });
}
