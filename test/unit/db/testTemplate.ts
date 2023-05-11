import { DBFactory } from "$/lib/db/DBFactory.ts";
import { AbstractConstructor, Constructor, Injector } from "$/lib/inject.ts";
import {
  columnCompare,
  ColumnType,
  DatabaseSpec,
  DB,
  Q,
  QueryOperator,
} from "$/lib/sql/mod.ts";
import { chainFrom } from "$/lib/transducers.ts";
import { UlidService } from "$/services/UlidService.ts";
import { assertArrayIncludes, assertEquals } from "asserts";

const COLUMNS = {
  id: { type: ColumnType.Ulid },
  name: { type: ColumnType.String },
  age: { type: ColumnType.Integer },
} as const;

const TEST_SPEC = {
  people: {
    primaryKey: "id",
    columns: COLUMNS,
  },
} as const;

export function testDatabaseService(
  factory: DBFactory,
  ...overrides: [Constructor | AbstractConstructor, Constructor][]
) {
  function newDb(): Promise<[DB<typeof TEST_SPEC>, UlidService]> {
    const injector = new Injector(...overrides);
    return Promise.all([
      injector.inject(factory.constructService(new DatabaseSpec(1, TEST_SPEC))),
      injector.resolve(UlidService),
    ]);
  }

  Deno.test("insert and get one row", async (t) => {
    const [db, ulid] = await newDb(),
      id = ulid.next(),
      row = { id, name: "Bob", age: 42 };
    await db.insert("people", [row]);

    await t.step("select all", async () => {
      assertEquals(await chainFrom(db.get("people", {})).toArray(), [row]);
    });
    await t.step("where id eq", async () => {
      assertEquals(
        await chainFrom(db.get("people", { where: { id } })).toArray(),
        [row],
      );
    });
    await t.step("where name eq", async () => {
      assertEquals(
        await chainFrom(db.get("people", { where: { name: "Bob" } })).toArray(),
        [row],
      );
    });
    await t.step("where age eq", async () => {
      assertEquals(
        await chainFrom(db.get("people", { where: { age: 42 } })).toArray(),
        [row],
      );
    });
    await t.step("where id and name eq", async () => {
      assertEquals(
        await chainFrom(
          db.get("people", {
            where: { id: new Q(QueryOperator.Equal, id), name: "Bob" },
          }),
        ).toArray(),
        [row],
      );
    });
    await t.step("where id eq different", async () => {
      assertEquals(
        await chainFrom(db.get("people", { where: { id: ulid.next() } }))
          .toArray(),
        [],
      );
    });
    await t.step("where name eq but id eq different", async () => {
      assertEquals(
        await chainFrom(
          db.get("people", { where: { id: ulid.next(), name: "Bob" } }),
        ).toArray(),
        [],
      );
    });
    await t.step("where id eq but name eq different", async () => {
      assertEquals(
        await chainFrom(
          db.get("people", { where: { id: id, name: "Alice" } }),
        ).toArray(),
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
      const queryAll = await chainFrom(db.get("people", {})).toArray();
      assertArrayIncludes(queryAll, [rows[0]]);
      assertArrayIncludes(queryAll, [rows[1]]);
      assertArrayIncludes(queryAll, [rows[2]]);
      assertEquals(queryAll.length, 3);
    });

    await t.step("select where age eq", async () => {
      const queryAll = await chainFrom(
        db.get("people", { where: { age: 32 } }),
      ).toArray();
      assertArrayIncludes(queryAll, [rows[0]]);
      assertArrayIncludes(queryAll, [rows[2]]);
      assertEquals(queryAll.length, 2);
    });

    await t.step("select where age neq", async () => {
      const queryAll = await chainFrom(
        db.get("people", { where: { age: new Q(QueryOperator.NotEqual, 32) } }),
      ).toArray();
      assertArrayIncludes(queryAll, [rows[1]]);
      assertEquals(queryAll.length, 1);
    });

    await t.step("select where age gt", async () => {
      const queryAll = await chainFrom(
        db.get("people", {
          where: { age: new Q(QueryOperator.GreaterThan, 32) },
        }),
      ).toArray();
      assertArrayIncludes(queryAll, [rows[1]]);
      assertEquals(queryAll.length, 1);
    });

    await t.step("select where age gte", async () => {
      const queryAll = await chainFrom(
        db.get("people", {
          where: { age: new Q(QueryOperator.GreaterThanEqual, 32) },
        }),
      ).toArray();
      assertArrayIncludes(queryAll, [rows[0]]);
      assertArrayIncludes(queryAll, [rows[1]]);
      assertArrayIncludes(queryAll, [rows[2]]);
      assertEquals(queryAll.length, 3);
    });

    await t.step("select where age lt", async () => {
      const queryAll = await chainFrom(
        db.get("people", {
          where: { age: new Q(QueryOperator.LowerThan, 42) },
        }),
      ).toArray();
      assertArrayIncludes(queryAll, [rows[0]]);
      assertArrayIncludes(queryAll, [rows[2]]);
      assertEquals(queryAll.length, 2);
    });

    await t.step("select where age lte", async () => {
      const queryAll = await chainFrom(
        db.get("people", {
          where: { age: new Q(QueryOperator.LowerThanEqual, 42) },
        }),
      ).toArray();
      assertArrayIncludes(queryAll, [rows[0]]);
      assertArrayIncludes(queryAll, [rows[1]]);
      assertArrayIncludes(queryAll, [rows[2]]);
      assertEquals(queryAll.length, 3);
    });

    await t.step("order by id ascending", async () => {
      assertEquals(
        await chainFrom(db.get("people", { orderBy: [["id", "ASC"]] }))
          .toArray(),
        rows,
      );
    });

    await t.step("order by id descending", async () => {
      assertEquals(
        await chainFrom(db.get("people", { orderBy: [["id", "DESC"]] }))
          .toArray(),
        [rows[2], rows[1], rows[0]],
      );
    });

    await t.step("order by age then name", async () => {
      assertEquals(
        await chainFrom(
          db.get("people", {
            orderBy: [["age", "ASC"], ["name", "DESC"]],
          }),
        ).toArray(),
        [rows[2], rows[0], rows[1]],
      );
    });

    await t.step("order by age then name, limit 2", async () => {
      assertEquals(
        await chainFrom(
          db.get("people", {
            orderBy: [["age", "ASC"], ["name", "DESC"]],
            limit: 2,
          }),
        ).toArray(),
        [rows[2], rows[0]],
      );
    });

    await db.close();
  });
}
