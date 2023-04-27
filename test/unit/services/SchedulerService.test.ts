import {
  Reschedule,
  SchedulerServiceImpl,
} from "$/services/SchedulerService.ts";
import { assertEquals } from "asserts";

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

Deno.test("Runs a task scheduled for now", async () => {
  const service = new SchedulerServiceImpl();
  let n = 0;
  service.schedule("foo", () => {
    n++;
  }, service.now());
  await sleep(100);
  assertEquals(n, 1, "increment should have run once");
});

Deno.test("Runs a task scheduled for 200ms from now (by literal date)", async () => {
  const service = new SchedulerServiceImpl();
  let n = 0;
  service.schedule("foo", () => {
    n++;
  }, service.now().add({ millisecond: 200 }));
  await sleep(100);
  assertEquals(n, 0, "increment should not have run yet");
  await sleep(200);
  assertEquals(n, 1, "increment should have run once");
});

Deno.test("Runs a task scheduled for 200ms from now (by interval object)", async () => {
  const service = new SchedulerServiceImpl();
  let n = 0;
  service.schedule("foo", () => {
    n++;
  }, { millisecond: 200 });
  await sleep(100);
  assertEquals(n, 0, "increment should not have run yet");
  await sleep(200);
  assertEquals(n, 1, "increment should have run once");
});

Deno.test("Scheduling tasks with two different names runs both of them", async () => {
  const service = new SchedulerServiceImpl();
  let n = 0;
  service.schedule("foo", () => {
    n++;
  }, { millisecond: 100 });
  service.schedule("bar", () => {
    n++;
  }, { millisecond: 200 });
  await sleep(300);
  assertEquals(n, 2, "increment should have run twice");
});

Deno.test("Scheduling a task with the same name runs only once", async () => {
  const service = new SchedulerServiceImpl();
  let n = 0;
  service.schedule("foo", () => {
    n++;
  }, { millisecond: 100 });
  service.schedule("foo", () => {
    n++;
  }, { millisecond: 200 });
  await sleep(300);
  assertEquals(n, 1, "increment should have run once");
});

Deno.test("When the same task is scheduled twice, the later definition always wins", async () => {
  const service = new SchedulerServiceImpl();
  let n = 0;
  service.schedule("foo", () => {
    n = 2;
  }, { millisecond: 100 });
  service.schedule("foo", () => {
    n = 3;
  }, { millisecond: 100 });
  await sleep(200);
  assertEquals(n, 3, "only the second definition of 'foo' should run");
});

Deno.test("A task can be canceled by name", async () => {
  const service = new SchedulerServiceImpl();
  let n = 0;
  service.schedule("foo", () => {
    n++;
  }, { millisecond: 100 });
  service.cancel("foo");
  await sleep(200);
  assertEquals(n, 0, "the canceled task should not have run");
});

Deno.test("Canceling a named task does not affect unrelated tasks", async () => {
  const service = new SchedulerServiceImpl();
  let n = 0;
  service.schedule("foo", () => {
    n += 1;
  }, { millisecond: 100 });
  service.schedule("foobar", () => {
    n += 2;
  }, { millisecond: 100 });
  service.cancel("foo");
  await sleep(200);
  assertEquals(n, 2, "only the uncanceled task 'foobar' should have run");
});

Deno.test("A task can be canceled by prefix", async () => {
  const service = new SchedulerServiceImpl();
  let n = 0;
  service.schedule("foobar", () => {
    n++;
  }, { millisecond: 100 });
  service.cancelAllWithPrefix("foo");
  await sleep(200);
  assertEquals(n, 0, "the canceled task should not have run");
});

Deno.test("Canceling tasks by prefix does not affect unrelated tasks", async () => {
  const service = new SchedulerServiceImpl();
  let n = 0;
  service.schedule("foo", () => {
    n += 1;
  }, { millisecond: 100 });
  service.schedule("foobar", () => {
    n += 2;
  }, { millisecond: 100 });
  service.schedule("bazqux", () => {
    n += 4;
  }, { millisecond: 100 });
  service.cancelAllWithPrefix("foo");
  await sleep(200);
  assertEquals(n, 4, "only the uncanceled task 'bazqux' should have run");
});

Deno.test("Reschedule.OnlyAsEarlier moves tasks earlier", async () => {
  const service = new SchedulerServiceImpl();
  let n = 0;
  service.schedule("foo", () => {
    n++;
  }, { millisecond: 300 });
  service.schedule(
    "foo",
    () => {
      n++;
    },
    { millisecond: 100 },
    Reschedule.OnlyAsEarlier,
  );
  await sleep(200);
  assertEquals(n, 1, "the task should have run after 200ms");
  await sleep(200);
  assertEquals(n, 1, "the task should have run only once after 400ms");
});

Deno.test("Reschedule.OnlyAsEarlier does not move tasks later", async () => {
  const service = new SchedulerServiceImpl();
  let n = 0;
  service.schedule("foo", () => {
    n++;
  }, { millisecond: 100 });
  service.schedule(
    "foo",
    () => {
      n++;
    },
    { millisecond: 300 },
    Reschedule.OnlyAsEarlier,
  );
  await sleep(200);
  assertEquals(n, 1, "the task should have run after 200ms");
  await sleep(200);
  assertEquals(n, 1, "the task should have run only once after 400ms");
});

Deno.test("Reschedule.OnlyAsEarlier can reschedule to now", async () => {
  const service = new SchedulerServiceImpl();
  let n = 0;
  service.schedule("foo", () => {
    n++;
  }, { millisecond: 200 });
  service.schedule(
    "foo",
    () => {
      n++;
    },
    service.now(),
    Reschedule.OnlyAsEarlier,
  );
  await sleep(100);
  assertEquals(n, 1, "the task should have run after 100ms");
  await sleep(200);
  assertEquals(n, 1, "the task should have run only once after 300ms");
});

Deno.test("Reschedule.OnlyAsEarlier does not prevent rescheduling a completed task", async () => {
  const service = new SchedulerServiceImpl();
  let n = 0;
  service.schedule("foo", () => {
    n++;
  }, { millisecond: 100 });
  await sleep(200);
  assertEquals(n, 1, "the task should have run after 200ms");
  service.schedule(
    "foo",
    () => {
      n++;
    },
    { millisecond: 100 },
    Reschedule.OnlyAsEarlier,
  );
  await sleep(200);
  assertEquals(n, 2, "the task should have run again after being rescheduled");
});

Deno.test("Reschedule.OnlyAsLater moves tasks later", async () => {
  const service = new SchedulerServiceImpl();
  let n = 0;
  service.schedule("foo", () => {
    n++;
  }, { millisecond: 100 });
  service.schedule(
    "foo",
    () => {
      n++;
    },
    { millisecond: 300 },
    Reschedule.OnlyAsLater,
  );
  await sleep(200);
  assertEquals(n, 0, "the task should not have run after 200ms");
  await sleep(200);
  assertEquals(n, 1, "the task should have run after 400ms");
});

Deno.test("Reschedule.OnlyAsLater does not move tasks earlier", async () => {
  const service = new SchedulerServiceImpl();
  let n = 0;
  service.schedule("foo", () => {
    n++;
  }, { millisecond: 300 });
  service.schedule(
    "foo",
    () => {
      n++;
    },
    { millisecond: 100 },
    Reschedule.OnlyAsLater,
  );
  await sleep(200);
  assertEquals(n, 0, "the task should not have run after 200ms");
  await sleep(200);
  assertEquals(n, 1, "the task should have run after 400ms");
});
