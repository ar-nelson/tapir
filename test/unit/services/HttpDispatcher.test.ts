import { MockDomainTrustStore } from "$/test/mock/MockDomainTrustStore.ts";
import { MockHttpClientService } from "$/test/mock/MockHttpClientService.ts";
import { MockSchedulerService } from "$/test/mock/MockSchedulerService.ts";

import { BackgroundTaskService } from "$/services/BackgroundTaskService.ts";
import { HttpDispatcherImpl, Priority } from "$/services/HttpDispatcher.ts";
import { assertEquals } from "asserts";
import { Context, Router, Status } from "oak";

function makeDispatcher() {
  const http = new MockHttpClientService();
  const scheduler = new MockSchedulerService();
  return {
    http,
    scheduler,
    dispatcher: new HttpDispatcherImpl(
      new MockDomainTrustStore(),
      http,
      scheduler,
      new BackgroundTaskService(),
    ),
  };
}

Deno.test("dispatch an immediate GET", async () => {
  const { http, dispatcher } = makeDispatcher();
  let n = 0;
  http.route(
    "example.test",
    new Router().get("/foo", (ctx) => {
      n++;
      ctx.response.body = "got a response";
    }),
  );
  const rsp = await dispatcher.dispatchAndWait(
    new Request("http://example.test/foo"),
    { priority: Priority.Immediate },
  );
  assertEquals(n, 1, "route handler should be called once");
  assertEquals(await rsp.text(), "got a response");
});

Deno.test("dispatch a GET with each priority", async () => {
  const { http, dispatcher } = makeDispatcher();
  let n = 0;
  http.route(
    "example.test",
    new Router().get("/foo", (ctx) => {
      n++;
      ctx.response.body = "got a response";
    }),
  );
  const priorities = [
    Priority.Immediate,
    Priority.Soon,
    Priority.Eventually,
    Priority.Optional,
  ];
  for (let i = 0; i < priorities.length; i++) {
    const rsp = await dispatcher.dispatchAndWait(
      new Request("http://example.test/foo"),
      { priority: priorities[i] },
    );
    assertEquals(
      n,
      i + 1,
      `route handler should be called once per priority (iteration i=${i})`,
    );
    assertEquals(await rsp.text(), "got a response");
  }
});

Deno.test("dispatch five GETs with a required ordering", async () => {
  const { http, dispatcher, scheduler } = makeDispatcher();
  const words: string[] = [];
  http.route(
    "example.test",
    new Router().get("/:word", (ctx) => {
      words.push(ctx.params.word);
      ctx.response.body = "got a response";
    }),
  );
  await dispatcher.dispatchInOrder(
    [
      new Request("http://example.test/foo"),
      new Request("http://example.test/bar"),
      new Request("http://example.test/baz"),
      new Request("http://example.test/qux"),
      new Request("http://example.test/quux"),
    ],
    { priority: Priority.Soon },
  );
  await scheduler.fastforward({ second: 1 });
  assertEquals(words, ["foo", "bar", "baz", "qux", "quux"]);
});

Deno.test("backoff after error (Priority: Soon)", async () => {
  const { http, scheduler, dispatcher } = makeDispatcher();
  let n = 0;
  http.route(
    "example.test",
    new Router().get("/foo", (ctx: Context) => {
      n++;
      ctx.assert(n >= 4, Status.Teapot);
      ctx.response.body = "got a response";
    }),
  );
  dispatcher.dispatch(
    new Request("http://example.test/foo"),
    { priority: Priority.Soon },
  );
  await scheduler.fastforward({ millisecond: 1 });
  assertEquals(n, 1);
  await scheduler.fastforward({ second: 5, millisecond: 1 });
  assertEquals(n, 2);
  await scheduler.fastforward({ second: 50, millisecond: 1 });
  assertEquals(n, 3);
  await scheduler.fastforward({ second: 500, millisecond: 1 });
  assertEquals(n, 4);
});

Deno.test("give up after repeated errors (Priority: Soon)", async () => {
  const { http, scheduler, dispatcher } = makeDispatcher();
  http.route(
    "example.test",
    new Router().get("/foo", (ctx: Context) => {
      ctx.throw(Status.Teapot);
    }),
  );
  const response = dispatcher.dispatchAndWait(
    new Request("http://example.test/foo"),
    { priority: Priority.Soon },
  );
  await scheduler.fastforward({ minute: 100 });
  assertEquals((await response).status, Status.Teapot);
});

Deno.test("preserve ordering even when waiting on errors (Priority: Soon)", async () => {
  const { http, dispatcher, scheduler } = makeDispatcher();
  const words: string[] = [];
  let n = 0;
  http.route(
    "example.test",
    new Router().get("/:word", (ctx) => {
      if ([1, 3].includes(++n)) {
        ctx.throw(Status.InternalServerError);
      } else {
        words.push(ctx.params.word);
        ctx.response.body = "got a response";
      }
    }),
  );
  dispatcher.dispatchInOrder(
    [
      new Request("http://example.test/foo"),
      new Request("http://example.test/bar"),
      new Request("http://example.test/baz"),
      new Request("http://example.test/qux"),
      new Request("http://example.test/quux"),
    ],
    { priority: Priority.Soon },
  );
  await scheduler.fastforward({ minute: 1 });
  assertEquals(words, ["foo", "bar", "baz", "qux", "quux"]);
});

Deno.test("delay future scheduled entries after a 429 (Priority: Soon)", async () => {
  const { http, scheduler, dispatcher } = makeDispatcher();
  let n = 0;
  http.route(
    "example.test",
    new Router().get("/foo", (ctx: Context) => {
      n++;
      ctx.assert(n >= 2, Status.TooManyRequests);
      ctx.response.body = "got a response";
    }),
  );
  dispatcher.dispatch(
    new Request("http://example.test/foo"),
    { priority: Priority.Soon },
  );
  await scheduler.fastforward({ millisecond: 1 });
  assertEquals(n, 1);
  const rsp2 = dispatcher.dispatchAndWait(
    new Request("http://example.test/foo"),
    { priority: Priority.Soon },
  );
  await scheduler.fastforward({ second: 5 });
  assertEquals(n, 1);
  await scheduler.fastforward({ minute: 5 });
  assertEquals(n, 3);
  await rsp2;
});

Deno.test("delay dispatches with Priority.Spaced even when request is successful", async () => {
  const { http, scheduler, dispatcher } = makeDispatcher();
  let n = 0;
  http.route(
    "example.test",
    new Router().get("/:word", (ctx: Context) => {
      n++;
      ctx.response.body = "got a response";
    }),
  );
  const rsp1 = dispatcher.dispatchAndWait(
    new Request("http://example.test/foo"),
    { priority: Priority.Spaced },
  );
  await scheduler.fastforward({ second: 1 });
  assertEquals(n, 1);
  const rsp2 = dispatcher.dispatchAndWait(
    new Request("http://example.test/bar"),
    { priority: Priority.Spaced },
  );
  await scheduler.fastforward({ second: 1 });
  assertEquals(n, 1);
  const rsp3 = dispatcher.dispatchAndWait(
    new Request("http://example.test/baz"),
    { priority: Priority.Spaced },
  );
  await scheduler.fastforward({ minute: 10 });
  assertEquals(n, 3);
  await Promise.all([rsp1, rsp2, rsp3]);
});

Deno.test("retry with a POST body", async () => {
  const { http, scheduler, dispatcher } = makeDispatcher();
  let n = 0, text = "text not set yet";
  http.route(
    "example.test",
    new Router().post("/foo", async (ctx: Context) => {
      n++;
      ctx.assert(n >= 2, Status.Teapot);
      text = await ctx.request.body({ type: "text" }).value;
      ctx.response.body = "got a response";
    }),
  );
  const response = dispatcher.dispatchAndWait(
    new Request("http://example.test/foo", {
      method: "POST",
      body: "got a POST body",
    }),
    { priority: Priority.Soon },
  );
  await scheduler.fastforward({ millisecond: 1 });
  assertEquals(n, 1);
  await scheduler.fastforward({ second: 55 });
  assertEquals(text, "got a POST body");
  await response;
});
