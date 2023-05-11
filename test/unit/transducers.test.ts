import { chainFrom, toMap } from "$/lib/transducers.ts";
import { assertEquals } from "asserts";

Deno.test("map toArray", () => {
  assertEquals(
    chainFrom([1, 2, 3]).map((x) => x + 1).toArray(),
    [2, 3, 4],
  );
});

Deno.test("map toSet", () => {
  assertEquals(
    chainFrom([1, 2, 3]).map((x) => x + 1).toSet(),
    new Set([2, 3, 4]),
  );
});

Deno.test("map toMap", () => {
  assertEquals(
    chainFrom([1, 2, 3]).map((x) => [x, x + 1] as const).collect(toMap()),
    new Map([[1, 2], [2, 3], [3, 4]]),
  );
});

Deno.test("long composition chain", () => {
  assertEquals(
    chainFrom([1, 2, 3, 4, 5])
      .map((x) => x + 1)
      .map((x) => x * 2)
      .map((x) => `${x}`)
      .map((x) => "foo" + x)
      .filter((x) => !x.endsWith("8"))
      .toArray(),
    ["foo4", "foo6", "foo10", "foo12"],
  );
});

Deno.test("mapAsync first", async () => {
  assertEquals(
    await chainFrom([1, 2, 3])
      .mapAsync((x) => Promise.resolve(x + 1))
      .map((x) => x * 2)
      .map((x) => `${x}`)
      .toArray(),
    ["4", "6", "8"],
  );
});

Deno.test("mapAsync last", async () => {
  assertEquals(
    await chainFrom([1, 2, 3])
      .liftAsync()
      .map((x) => x + 1)
      .map((x) => x * 2)
      .mapAsync((x) => Promise.resolve(`${x}`))
      .toArray(),
    ["4", "6", "8"],
  );
});

Deno.test("mapAsync repeatedly", async () => {
  assertEquals(
    await chainFrom([1, 2, 3])
      .mapAsync((x) => Promise.resolve(x + 1))
      .mapAsync((x) => Promise.resolve(x * 2))
      .mapAsync((x) => Promise.resolve(`${x}`))
      .toArray(),
    ["4", "6", "8"],
  );
});

Deno.test("map async iterator", async () => {
  assertEquals(
    await chainFrom((async function* () {
      for (let i = 1; i < 4; i++) yield i;
    })())
      .map((x) => x + 1)
      .map((x) => x * 2)
      .mapAsync((x) => Promise.resolve(`${x}`))
      .toArray(),
    ["4", "6", "8"],
  );
});
