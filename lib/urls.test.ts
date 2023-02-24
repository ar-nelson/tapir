import * as urls from "./urls.ts";
import { assertEquals } from "https://deno.land/std@0.176.0/testing/asserts.ts";

const base = "http://example.com";

Deno.test("deconstructs actor URLs", () => {
  assertEquals(
    urls.isActivityPubActor(urls.activityPubActor("foo", base), base),
    "foo",
  );
  assertEquals(
    urls.isActivityPubActor(urls.activityPubActor("a.b-c", base), base),
    "a.b-c",
  );
});

Deno.test("doesn't deconstruct invalid actor URLs", () => {
  assertEquals(
    urls.isActivityPubActor(urls.activityPubInbox("foo", base), base),
    null,
  );
  assertEquals(
    urls.isActivityPubActor(urls.activityPubActor("foo"), base),
    null,
  );
});

Deno.test("deconstructs followers URLs", () => {
  assertEquals(
    urls.isActivityPubFollowers(urls.activityPubFollowers("foo", base), base),
    "foo",
  );
  assertEquals(
    urls.isActivityPubFollowers(urls.activityPubFollowers("a.b-c", base), base),
    "a.b-c",
  );
});

Deno.test("doesn't deconstruct invalid followers URLs", () => {
  assertEquals(
    urls.isActivityPubFollowers(urls.activityPubActor("foo", base), base),
    null,
  );
  assertEquals(
    urls.isActivityPubFollowers(urls.activityPubFollowers("foo"), base),
    null,
  );
});
