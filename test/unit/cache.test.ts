import { LfuCache } from "$/lib/cache.ts";
import { assertEquals } from "asserts";

Deno.test("can insert and get items", () => {
  const cache = new LfuCache<string, string>();
  cache.insert("foo", "bar");
  cache.insert("baz", "qux");
  assertEquals(cache.get("foo"), "bar");
  assertEquals(cache.get("bar"), undefined);
  assertEquals(cache.get("baz"), "qux");
});

Deno.test("can get items multiple times", () => {
  const cache = new LfuCache<string, string>();
  cache.insert("foo", "bar");
  cache.insert("baz", "qux");
  assertEquals(cache.get("foo"), "bar");
  assertEquals(cache.get("foo"), "bar");
  assertEquals(cache.get("foo"), "bar");
  assertEquals(cache.get("baz"), "qux");
});

Deno.test("iterates items in insertion order", () => {
  const cache = new LfuCache<string, number>();
  cache.insert("foo", 1);
  cache.insert("bar", 2);
  cache.insert("baz", 3);
  assertEquals([...cache], [["foo", 1], ["bar", 2], ["baz", 3]]);
});

Deno.test("iterates items in reverse priority order", () => {
  const cache = new LfuCache<string, number>();
  cache.insert("foo", 1);
  cache.insert("bar", 2);
  cache.insert("baz", 3);
  cache.get("baz");
  cache.get("foo");
  cache.get("foo");
  cache.get("bar");
  cache.get("bar");
  cache.get("bar");
  assertEquals([...cache], [["baz", 3], ["foo", 1], ["bar", 2]]);
});

Deno.test("evicts items when over capacity", () => {
  const cache = new LfuCache<string, number>({
    maxCount: 3,
    dynamicAging: false,
  });

  cache.insert("foo", 1);
  cache.insert("bar", 2);
  cache.insert("baz", 3);

  assertEquals(cache.count, 3);
  assertEquals(cache.get("foo"), 1);
  assertEquals(cache.get("baz"), 3);

  cache.insert("qux", 4);

  assertEquals(cache.count, 3);
  assertEquals(cache.get("foo"), 1);
  assertEquals(cache.get("bar"), undefined);
  assertEquals(cache.get("baz"), 3);
  assertEquals(cache.get("qux"), 4);
});

Deno.test("evicts older items first when nothing is accessed", () => {
  const cache = new LfuCache<string, number>({
    maxCount: 3,
    dynamicAging: false,
  });

  cache.insert("foo", 1);
  cache.insert("bar", 2);
  cache.insert("baz", 3);

  assertEquals(cache.count, 3);

  cache.insert("qux", 4);

  assertEquals(cache.count, 3);
  assertEquals(cache.get("foo"), undefined);
  assertEquals(cache.get("bar"), 2);
  assertEquals(cache.get("baz"), 3);
  assertEquals(cache.get("qux"), 4);
});

Deno.test("calls an onEvict callback", () => {
  const evicted: [string, number][] = [];

  const cache = new LfuCache<string, number>({
    maxCount: 3,
    dynamicAging: false,
    onEvict: (k, v) => evicted.push([k, v]),
  });

  cache.insert("foo", 1);
  cache.insert("bar", 2);
  cache.insert("baz", 3);

  assertEquals(cache.count, 3);
  assertEquals(cache.get("foo"), 1);
  assertEquals(cache.get("baz"), 3);

  cache.insert("qux", 4);

  assertEquals(cache.count, 3);
  assertEquals(evicted, [["bar", 2]]);
});

Deno.test("supports dynamic aging", () => {
  const evicted: [string, number][] = [];

  const cache = new LfuCache<string, number>({
    maxCount: 3,
    dynamicAging: true,
    onEvict: (k, v) => evicted.push([k, v]),
  });

  cache.insert("foo", 1);
  cache.insert("bar", 2);
  cache.insert("baz", 3);

  assertEquals(cache.get("foo"), 1);
  assertEquals(cache.get("foo"), 1);
  assertEquals(cache.get("foo"), 1);

  cache.insert("qux", 4);
  cache.insert("quux", 5);

  assertEquals(cache.count, 3);
  assertEquals(cache.get("qux"), 4);
  assertEquals(cache.get("qux"), 4);
  assertEquals(cache.get("quux"), 5);
  assertEquals(cache.get("quux"), 5);

  cache.insert("corge", 6);
  cache.insert("grault", 7);

  assertEquals(cache.count, 3);
  assertEquals(cache.get("grault"), 7);
  assertEquals(cache.get("grault"), 7);

  cache.insert("garply", 8);
  assertEquals(cache.get("garply"), 8);
  cache.insert("fred", 9);

  assertEquals(evicted, [
    ["bar", 2],
    ["baz", 3],
    ["qux", 4],
    ["quux", 5],
    ["corge", 6],
    ["foo", 1],
  ]);
});

Deno.test("supports size", () => {
  const evicted: [string, number][] = [];

  const cache = new LfuCache<string, number>({
    maxCount: 3,
    dynamicAging: false,
    onEvict: (k, v) => evicted.push([k, v]),
    computeSize: (n) => n,
  });

  cache.insert("foo", 1);
  cache.insert("bar", 2);
  cache.insert("baz", 3);

  assertEquals(cache.get("foo"), 1);
  assertEquals(cache.get("foo"), 1);
  assertEquals(cache.get("foo"), 1);

  assertEquals(cache.get("bar"), 2);
  assertEquals(cache.get("bar"), 2);
  assertEquals(cache.get("bar"), 2);
  assertEquals(cache.get("bar"), 2);

  assertEquals(cache.get("baz"), 3);
  assertEquals(cache.get("baz"), 3);
  assertEquals(cache.get("baz"), 3);
  assertEquals(cache.get("baz"), 3);

  cache.insert("qux", 1);
  assertEquals(cache.get("qux"), 1);
  assertEquals(cache.get("qux"), 1);
  assertEquals(cache.get("qux"), 1);

  cache.insert("quux", 1);

  assertEquals(cache.count, 3);
  assertEquals(evicted, [["baz", 3], ["bar", 2]]);
});

//Deno.test("supports a maximum size limit", () => {
//});
