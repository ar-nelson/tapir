import { columnCompare, ColumnType, Q, QueryOperator } from "$/lib/sql/mod.ts";
import {
  DatabaseService,
  DatabaseServiceFactory,
} from "$/services/DatabaseService.ts";
import { UlidService } from "$/services/UlidService.ts";
import { AbstractConstructor, Constructor, Injector } from "$/lib/inject.ts";
import { asyncToArray as collect } from "$/lib/utils.ts";
import { assertArrayIncludes, assertEquals } from "$/deps.ts";

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

  function newDb(): Promise<[DatabaseService<typeof TEST_SPEC>, UlidService]> {
    const injector = new Injector(overrides);
    return Promise.all([
      injector.resolve(DatabaseService),
      injector.resolve(UlidService),
    ]);
  }

  Deno.test("insert and get one row", async (t) => {
    const [db, ulid] = await newDb(),
      id = ulid.next(),
      row = { id, name: "Bob", age: 42 };
    await db.insert("people", [row]);

    await t.step("select all", async () => {
      assertEquals(await collect(db.get("people", {})), [row]);
    });
    await t.step("where id eq", async () => {
      assertEquals(
        await collect(db.get("people", { where: { id } })),
        [row],
      );
    });
    await t.step("where name eq", async () => {
      assertEquals(
        await collect(db.get("people", { where: { name: "Bob" } })),
        [row],
      );
    });
    await t.step("where age eq", async () => {
      assertEquals(
        await collect(db.get("people", { where: { age: 42 } })),
        [row],
      );
    });
    await t.step("where id and name eq", async () => {
      assertEquals(
        await collect(
          db.get("people", {
            where: { id: new Q(QueryOperator.Equal, id), name: "Bob" },
          }),
        ),
        [row],
      );
    });
    await t.step("where id eq different", async () => {
      assertEquals(
        await collect(db.get("people", { where: { id: ulid.next() } })),
        [],
      );
    });
    await t.step("where name eq but id eq different", async () => {
      assertEquals(
        await collect(
          db.get("people", { where: { id: ulid.next(), name: "Bob" } }),
        ),
        [],
      );
    });
    await t.step("where id eq but name eq different", async () => {
      assertEquals(
        await collect(
          db.get("people", { where: { id: id, name: "Alice" } }),
        ),
        [],
      );
    });
    await db.close();
  });

  Deno.test("insert and get three rows", async (t) => {
    const [db, ulid] = await newDb(),
      id1 = ulid.next(),
      id2 = ulid.next(),
      id3 = ulid.next(),
      rows = [
        { id: id1, name: "Alice", age: 32 },
        { id: id2, name: "Bob", age: 42 },
        { id: id3, name: "Charlie", age: 32 },
      ];
    await db.insert("people", rows);

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
      const queryAll = await collect(db.get("people", {}));
      assertArrayIncludes(queryAll, [rows[0]]);
      assertArrayIncludes(queryAll, [rows[1]]);
      assertArrayIncludes(queryAll, [rows[2]]);
      assertEquals(queryAll.length, 3);
    });

    await t.step("select where age eq", async () => {
      const queryAll = await collect(
        db.get("people", { where: { age: 32 } }),
      );
      assertArrayIncludes(queryAll, [rows[0]]);
      assertArrayIncludes(queryAll, [rows[2]]);
      assertEquals(queryAll.length, 2);
    });

    await t.step("select where age neq", async () => {
      const queryAll = await collect(
        db.get("people", { where: { age: new Q(QueryOperator.NotEqual, 32) } }),
      );
      assertArrayIncludes(queryAll, [rows[1]]);
      assertEquals(queryAll.length, 1);
    });

    await t.step("select where age gt", async () => {
      const queryAll = await collect(
        db.get("people", {
          where: { age: new Q(QueryOperator.GreaterThan, 32) },
        }),
      );
      assertArrayIncludes(queryAll, [rows[1]]);
      assertEquals(queryAll.length, 1);
    });

    await t.step("select where age gte", async () => {
      const queryAll = await collect(
        db.get("people", {
          where: { age: new Q(QueryOperator.GreaterThanEqual, 32) },
        }),
      );
      assertArrayIncludes(queryAll, [rows[0]]);
      assertArrayIncludes(queryAll, [rows[1]]);
      assertArrayIncludes(queryAll, [rows[2]]);
      assertEquals(queryAll.length, 3);
    });

    await t.step("select where age lt", async () => {
      const queryAll = await collect(
        db.get("people", {
          where: { age: new Q(QueryOperator.LowerThan, 42) },
        }),
      );
      assertArrayIncludes(queryAll, [rows[0]]);
      assertArrayIncludes(queryAll, [rows[2]]);
      assertEquals(queryAll.length, 2);
    });

    await t.step("select where age lte", async () => {
      const queryAll = await collect(
        db.get("people", {
          where: { age: new Q(QueryOperator.LowerThanEqual, 42) },
        }),
      );
      assertArrayIncludes(queryAll, [rows[0]]);
      assertArrayIncludes(queryAll, [rows[1]]);
      assertArrayIncludes(queryAll, [rows[2]]);
      assertEquals(queryAll.length, 3);
    });

    await t.step("order by id ascending", async () => {
      assertEquals(
        await collect(db.get("people", { orderBy: [["id", "ASC"]] })),
        rows,
      );
    });

    await t.step("order by id descending", async () => {
      assertEquals(
        await collect(db.get("people", { orderBy: [["id", "DESC"]] })),
        [rows[2], rows[1], rows[0]],
      );
    });

    await t.step("order by age then name", async () => {
      assertEquals(
        await collect(
          db.get("people", {
            orderBy: [["age", "ASC"], ["name", "DESC"]],
          }),
        ),
        [rows[2], rows[0], rows[1]],
      );
    });

    await t.step("order by age then name, limit 2", async () => {
      assertEquals(
        await collect(
          db.get("people", {
            orderBy: [["age", "ASC"], ["name", "DESC"]],
            limit: 2,
          }),
        ),
        [rows[2], rows[0]],
      );
    });

    await db.close();
  });
}
