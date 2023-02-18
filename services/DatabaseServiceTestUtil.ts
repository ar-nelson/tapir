import {
  assertArrayIncludes,
  assertEquals,
} from "https://deno.land/std@0.176.0/testing/asserts.ts";
import {
  columnCompare,
  ColumnType,
  DatabaseService,
  DatabaseServiceFactory,
  Order,
  QueryOp,
} from "$/services/DatabaseService.ts";
import { UlidService } from "$/services/UlidService.ts";
import { AbstractConstructor, Constructor, Injector } from "$/lib/inject.ts";
import { asyncToArray as collect } from "$/lib/utils.ts";

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

export async function testDatabaseService(
  factory: DatabaseServiceFactory,
  overrides: Map<Constructor | AbstractConstructor, Constructor> = new Map(),
) {
  overrides.set(DatabaseService, await factory.init(TEST_SPEC));

  function newDb(): [DatabaseService<typeof TEST_SPEC>, UlidService] {
    const injector = new Injector(overrides);
    return [injector.resolve(DatabaseService), injector.resolve(UlidService)];
  }

  Deno.test("insert and get one row", async (t) => {
    const [db, ulid] = newDb(),
      table = db.table("people"),
      id = ulid.next(),
      row = { id, name: "Bob", age: 42 };
    await table.insert([row]);

    await t.step("select all", async () => {
      assertEquals(await collect(table.get({})), [row]);
    });
    await t.step("where id eq", async () => {
      assertEquals(
        await collect(table.get({ where: { id: [QueryOp.Eq, id] } })),
        [row],
      );
    });
    await t.step("where name eq", async () => {
      assertEquals(
        await collect(table.get({ where: { name: [QueryOp.Eq, "Bob"] } })),
        [row],
      );
    });
    await t.step("where age eq", async () => {
      assertEquals(
        await collect(table.get({ where: { age: [QueryOp.Eq, 42] } })),
        [row],
      );
    });
    await t.step("where id and name eq", async () => {
      assertEquals(
        await collect(
          table.get({
            where: { id: [QueryOp.Eq, id], name: [QueryOp.Eq, "Bob"] },
          }),
        ),
        [row],
      );
    });
    await t.step("where id eq different", async () => {
      assertEquals(
        await collect(table.get({ where: { id: [QueryOp.Eq, ulid.next()] } })),
        [],
      );
    });
    await t.step("where name eq but id eq different", async () => {
      assertEquals(
        await collect(
          table.get({
            where: { id: [QueryOp.Eq, ulid.next()], name: [QueryOp.Eq, "Bob"] },
          }),
        ),
        [],
      );
    });
    await t.step("where id eq but name eq different", async () => {
      assertEquals(
        await collect(
          table.get({
            where: { id: [QueryOp.Eq, id], name: [QueryOp.Eq, "Alice"] },
          }),
        ),
        [],
      );
    });
  });

  Deno.test("insert and get three rows", async (t) => {
    const [db, ulid] = newDb(),
      table = db.table("people"),
      id1 = ulid.next(),
      id2 = ulid.next(),
      id3 = ulid.next(),
      rows = [
        { id: id1, name: "Alice", age: 32 },
        { id: id2, name: "Bob", age: 42 },
        { id: id3, name: "Charlie", age: 32 },
      ];
    await table.insert(rows);

    await t.step("ulids are ordered", () => {
      assertEquals(id1.localeCompare(id2), -1);
      assertEquals(id2.localeCompare(id3), -1);
    });

    await t.step("columnCompare works", () => {
      const cmp = columnCompare({ type: ColumnType.Ulid });
      assertEquals(cmp(id1, id1), 0);
      assertEquals(cmp(id1, id2), -1);
      assertEquals(cmp(id2, id3), -1);
      assertEquals(cmp(id1, id3), -1);
      assertEquals(cmp(id3, id2), 1);
      assertEquals(cmp(id2, id1), 1);
      assertEquals(cmp(id2, id1), 1);
    });

    await t.step("select all unordered", async () => {
      const queryAll = await collect(table.get({}));
      assertArrayIncludes(queryAll, [rows[0]]);
      assertArrayIncludes(queryAll, [rows[1]]);
      assertArrayIncludes(queryAll, [rows[2]]);
      assertEquals(queryAll.length, 3);
    });

    await t.step("select where age eq", async () => {
      const queryAll = await collect(
        table.get({ where: { age: [QueryOp.Eq, 32] } }),
      );
      assertArrayIncludes(queryAll, [rows[0]]);
      assertArrayIncludes(queryAll, [rows[2]]);
      assertEquals(queryAll.length, 2);
    });

    await t.step("select where age neq", async () => {
      const queryAll = await collect(
        table.get({ where: { age: [QueryOp.Neq, 32] } }),
      );
      assertArrayIncludes(queryAll, [rows[1]]);
      assertEquals(queryAll.length, 1);
    });

    await t.step("select where age gt", async () => {
      const queryAll = await collect(
        table.get({ where: { age: [QueryOp.Gt, 32] } }),
      );
      assertArrayIncludes(queryAll, [rows[1]]);
      assertEquals(queryAll.length, 1);
    });

    await t.step("select where age gte", async () => {
      const queryAll = await collect(
        table.get({ where: { age: [QueryOp.Gte, 32] } }),
      );
      assertArrayIncludes(queryAll, [rows[0]]);
      assertArrayIncludes(queryAll, [rows[1]]);
      assertArrayIncludes(queryAll, [rows[2]]);
      assertEquals(queryAll.length, 3);
    });

    await t.step("select where age lt", async () => {
      const queryAll = await collect(
        table.get({ where: { age: [QueryOp.Lt, 42] } }),
      );
      assertArrayIncludes(queryAll, [rows[0]]);
      assertArrayIncludes(queryAll, [rows[2]]);
      assertEquals(queryAll.length, 2);
    });

    await t.step("select where age lte", async () => {
      const queryAll = await collect(
        table.get({ where: { age: [QueryOp.Lte, 42] } }),
      );
      assertArrayIncludes(queryAll, [rows[0]]);
      assertArrayIncludes(queryAll, [rows[1]]);
      assertArrayIncludes(queryAll, [rows[2]]);
      assertEquals(queryAll.length, 3);
    });

    await t.step("order by id ascending", async () => {
      assertEquals(
        await collect(table.get({ orderBy: [["id", Order.Ascending]] })),
        rows,
      );
    });

    await t.step("order by id descending", async () => {
      assertEquals(
        await collect(table.get({ orderBy: [["id", Order.Descending]] })),
        [rows[2], rows[1], rows[0]],
      );
    });

    await t.step("order by age then name", async () => {
      assertEquals(
        await collect(
          table.get({
            orderBy: [["age", Order.Ascending], ["name", Order.Descending]],
          }),
        ),
        [rows[2], rows[0], rows[1]],
      );
    });

    await t.step("order by age then name, limit 2", async () => {
      assertEquals(
        await collect(
          table.get({
            orderBy: [["age", Order.Ascending], ["name", Order.Descending]],
            limit: 2,
          }),
        ),
        [rows[2], rows[0]],
      );
    });
  });
}
