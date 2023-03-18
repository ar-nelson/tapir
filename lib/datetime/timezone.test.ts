import { assertEquals } from "$/deps.ts";
import { Timezone } from "./types.ts";
import { tzOffset } from "./timezone.ts";
import { MILLISECONDS_IN_HOUR } from "./constants.ts";

Deno.test("tzOffset", () => {
  type Test = {
    date: Date;
    tz: Timezone;
    expected: number;
  };
  const tests: Test[] = [
    { date: new Date("2021-05-13T12:15:30Z"), tz: "Asia/Tokyo", expected: 9 },
    { date: new Date("2021-05-13T12:15:30Z"), tz: "UTC", expected: 0 },
    {
      date: new Date("2021-05-13T12:15:30Z"),
      tz: "America/New_York",
      expected: -4,
    },
    {
      date: new Date("2021-12-13T12:15:30Z"),
      tz: "America/New_York",
      expected: -5,
    },
  ];
  tests.forEach((t) => {
    assertEquals(tzOffset(t.date, t.tz), t.expected * MILLISECONDS_IN_HOUR);
  });
});
