import { PriorityQueue } from "$/lib/priorityQueue.ts";
import { assertEquals } from "asserts";

Deno.test("priority queue", () => {
  const queue = new PriorityQueue<number>();
  for (const i of [1, 7, 4, 2, 8, 10, 44, 999, 0]) {
    queue.push(i);
  }
  const sorted: number[] = [];
  while (!queue.isEmpty()) sorted.push(queue.pop()!);
  assertEquals(sorted, [999, 44, 10, 8, 7, 4, 2, 1, 0]);
});

Deno.test("pop then push", () => {
  const queue = new PriorityQueue<number>();
  for (const i of [1, 7, 4, 2, 8, 10, 44, 999, 0]) {
    queue.push(i);
  }
  queue.pop();
  queue.pop();
  queue.push(3);
  const sorted: number[] = [];
  while (!queue.isEmpty()) sorted.push(queue.pop()!);
  assertEquals(sorted, [10, 8, 7, 4, 3, 2, 1, 0]);
});
