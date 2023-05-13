import { assertEquals } from "$/deps.ts";
import { formatDate, formatDateObj } from "$/lib/datetime/format.ts";
import { Locale } from "$/lib/datetime/locale.ts";
import { DateObj, Option, Timezone } from "$/lib/datetime/types.ts";

const defaultLocale = new Locale("en");
Deno.test("format: YY", () => {
  const tests = [
    {
      input: {
        year: 2021,
        month: 1,
        day: 1,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "21",
    },
    {
      input: {
        year: 1900,
        month: 3,
        day: 1,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "00",
    },
  ];
  tests.forEach((t) => {
    assertEquals(formatDateObj(t.input, "YY", defaultLocale), t.expected);
  });
});

Deno.test("format: YYYY", () => {
  const tests = [
    {
      input: {
        year: 2021,
        month: 1,
        day: 1,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "2021",
    },
    {
      input: {
        year: 1900,
        month: 3,
        day: 1,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "1900",
    },
  ];
  tests.forEach((t) => {
    assertEquals(formatDateObj(t.input, "YYYY", defaultLocale), t.expected);
  });
});

Deno.test("format: M", () => {
  const tests = [
    {
      input: {
        year: 2021,
        month: 1,
        day: 1,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "1",
    },
    {
      input: {
        year: 2021,
        month: 8,
        day: 1,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "8",
    },
    {
      input: {
        year: 2021,
        month: 11,
        day: 15,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "11",
    },
  ];
  tests.forEach((t) => {
    assertEquals(formatDateObj(t.input, "M", defaultLocale), t.expected);
  });
});

Deno.test("format: MM", () => {
  const tests = [
    {
      input: {
        year: 2021,
        month: 1,
        day: 1,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "01",
    },
    {
      input: {
        year: 2021,
        month: 8,
        day: 1,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "08",
    },
    {
      input: {
        year: 2021,
        month: 11,
        day: 15,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "11",
    },
  ];
  tests.forEach((t) => {
    assertEquals(formatDateObj(t.input, "MM", defaultLocale), t.expected);
  });
});

Deno.test("format: MMM", () => {
  const tests = [
    {
      input: {
        year: 2021,
        month: 1,
        day: 1,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "Jan",
    },
    {
      input: {
        year: 2021,
        month: 8,
        day: 1,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "Aug",
    },
    {
      input: {
        year: 2021,
        month: 11,
        day: 15,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "Nov",
    },
  ];
  tests.forEach((t) => {
    assertEquals(formatDateObj(t.input, "MMM", defaultLocale), t.expected);
  });
});

Deno.test("format: MMM ja", () => {
  const tests = [
    {
      input: {
        year: 2021,
        month: 1,
        day: 1,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "1月",
    },
    {
      input: {
        year: 2021,
        month: 8,
        day: 1,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "8月",
    },
    {
      input: {
        year: 2021,
        month: 11,
        day: 15,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "11月",
    },
  ];
  const locale = new Locale("ja");
  tests.forEach((t) => {
    assertEquals(formatDateObj(t.input, "MMM", locale), t.expected);
  });
});

Deno.test("format: MMMM", () => {
  const tests = [
    {
      input: {
        year: 2021,
        month: 1,
        day: 1,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "January",
    },
    {
      input: {
        year: 2021,
        month: 8,
        day: 1,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "August",
    },
    {
      input: {
        year: 2021,
        month: 11,
        day: 15,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "November",
    },
  ];
  tests.forEach((t) => {
    assertEquals(formatDateObj(t.input, "MMMM", defaultLocale), t.expected);
  });
});

Deno.test("format: MMMM ja", () => {
  const tests = [
    {
      input: {
        year: 2021,
        month: 1,
        day: 1,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "1月",
    },
    {
      input: {
        year: 2021,
        month: 8,
        day: 1,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "8月",
    },
    {
      input: {
        year: 2021,
        month: 11,
        day: 15,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "11月",
    },
  ];
  const locale = new Locale("ja");
  tests.forEach((t) => {
    assertEquals(formatDateObj(t.input, "MMMM", locale), t.expected);
  });
});

Deno.test("format: d", () => {
  const tests = [
    {
      input: {
        year: 2021,
        month: 1,
        day: 1,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "1",
    },
    {
      input: {
        year: 2021,
        month: 11,
        day: 15,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "15",
    },
  ];
  tests.forEach((t) => {
    assertEquals(formatDateObj(t.input, "d", defaultLocale), t.expected);
  });
});

Deno.test("format: dd", () => {
  const tests = [
    {
      input: {
        year: 2021,
        month: 1,
        day: 1,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "01",
    },
    {
      input: {
        year: 2021,
        month: 11,
        day: 15,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "15",
    },
  ];
  tests.forEach((t) => {
    assertEquals(formatDateObj(t.input, "dd", defaultLocale), t.expected);
  });
});

Deno.test("format: D", () => {
  const tests = [
    {
      input: {
        year: 2021,
        month: 1,
        day: 1,
        hour: 21,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "1",
    },
    {
      input: {
        year: 2021,
        month: 12,
        day: 31,
        hour: 21,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "365",
    },
    {
      input: {
        year: 2020,
        month: 12,
        day: 31,
        hour: 21,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "366",
    },
  ];
  tests.forEach((t) => {
    assertEquals(formatDateObj(t.input, "D", defaultLocale), t.expected);
  });
});

Deno.test("format: DDD", () => {
  const tests = [
    {
      input: {
        year: 2021,
        month: 1,
        day: 1,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "001",
    },
    {
      input: {
        year: 2021,
        month: 2,
        day: 23,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "054",
    },
    {
      input: {
        year: 2021,
        month: 12,
        day: 31,
        hour: 21,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "365",
    },
    {
      input: {
        year: 2020,
        month: 12,
        day: 31,
        hour: 21,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "366",
    },
  ];
  tests.forEach((t) => {
    assertEquals(formatDateObj(t.input, "DDD", defaultLocale), t.expected);
  });
});

Deno.test("format: H", () => {
  const tests = [
    {
      input: {
        year: 2021,
        month: 1,
        day: 1,
        hour: 4,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "4",
    },
    {
      input: {
        year: 2021,
        month: 12,
        day: 31,
        hour: 9,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "9",
    },
    {
      input: {
        year: 2020,
        month: 12,
        day: 31,
        hour: 21,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "21",
    },
    {
      input: {
        year: 2020,
        month: 12,
        day: 31,
        hour: 23,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "23",
    },
  ];
  tests.forEach((t) => {
    assertEquals(formatDateObj(t.input, "H", defaultLocale), t.expected);
  });
});

Deno.test("format: HH", () => {
  const tests = [
    {
      input: {
        year: 2021,
        month: 1,
        day: 1,
        hour: 4,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "04",
    },
    {
      input: {
        year: 2021,
        month: 12,
        day: 31,
        hour: 9,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "09",
    },
    {
      input: {
        year: 2020,
        month: 12,
        day: 31,
        hour: 21,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "21",
    },
    {
      input: {
        year: 2020,
        month: 12,
        day: 31,
        hour: 23,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "23",
    },
  ];
  tests.forEach((t) => {
    assertEquals(formatDateObj(t.input, "HH", defaultLocale), t.expected);
  });
});

Deno.test("format: h", () => {
  const tests = [
    {
      input: {
        year: 2021,
        month: 1,
        day: 1,
        hour: 4,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "4",
    },
    {
      input: {
        year: 2021,
        month: 12,
        day: 31,
        hour: 9,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "9",
    },
    {
      input: {
        year: 2020,
        month: 12,
        day: 31,
        hour: 21,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "9",
    },
    {
      input: {
        year: 2020,
        month: 12,
        day: 31,
        hour: 23,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "11",
    },
  ];
  tests.forEach((t) => {
    assertEquals(formatDateObj(t.input, "h", defaultLocale), t.expected);
  });
});

Deno.test("format: hh", () => {
  const tests = [
    {
      input: {
        year: 2021,
        month: 1,
        day: 1,
        hour: 4,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "04",
    },
    {
      input: {
        year: 2021,
        month: 12,
        day: 31,
        hour: 9,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "09",
    },
    {
      input: {
        year: 2020,
        month: 12,
        day: 31,
        hour: 21,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "09",
    },
    {
      input: {
        year: 2020,
        month: 12,
        day: 31,
        hour: 23,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "11",
    },
  ];
  tests.forEach((t) => {
    assertEquals(formatDateObj(t.input, "hh", defaultLocale), t.expected);
  });
});

Deno.test("format: m", () => {
  const tests = [
    {
      input: {
        year: 2021,
        month: 1,
        day: 1,
        hour: 1,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "0",
    },
    {
      input: {
        year: 2021,
        month: 12,
        day: 31,
        hour: 1,
        minute: 1,
        second: 0,
        millisecond: 0,
      },
      expected: "1",
    },
    {
      input: {
        year: 2020,
        month: 12,
        day: 31,
        hour: 1,
        minute: 10,
        second: 0,
        millisecond: 0,
      },
      expected: "10",
    },
    {
      input: {
        year: 2020,
        month: 12,
        day: 31,
        hour: 1,
        minute: 59,
        second: 0,
        millisecond: 0,
      },
      expected: "59",
    },
  ];
  tests.forEach((t) => {
    assertEquals(formatDateObj(t.input, "m", defaultLocale), t.expected);
  });
});

Deno.test("format: mm", () => {
  const tests = [
    {
      input: {
        year: 2021,
        month: 1,
        day: 1,
        hour: 1,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "00",
    },
    {
      input: {
        year: 2021,
        month: 12,
        day: 31,
        hour: 1,
        minute: 1,
        second: 0,
        millisecond: 0,
      },
      expected: "01",
    },
    {
      input: {
        year: 2020,
        month: 12,
        day: 31,
        hour: 1,
        minute: 10,
        second: 0,
        millisecond: 0,
      },
      expected: "10",
    },
    {
      input: {
        year: 2020,
        month: 12,
        day: 31,
        hour: 1,
        minute: 59,
        second: 0,
        millisecond: 0,
      },
      expected: "59",
    },
  ];
  tests.forEach((t) => {
    assertEquals(formatDateObj(t.input, "mm", defaultLocale), t.expected);
  });
});

Deno.test("format: a", () => {
  const tests = [
    {
      input: {
        year: 2021,
        month: 1,
        day: 1,
        hour: 4,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "AM",
    },
    {
      input: {
        year: 2021,
        month: 12,
        day: 31,
        hour: 12,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "AM",
    },
    {
      input: {
        year: 2020,
        month: 12,
        day: 31,
        hour: 13,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "PM",
    },
    {
      input: {
        year: 2020,
        month: 12,
        day: 31,
        hour: 23,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "PM",
    },
  ];
  tests.forEach((t) => {
    assertEquals(formatDateObj(t.input, "a", defaultLocale), t.expected);
  });
});

Deno.test("format: w", () => {
  const tests = [
    {
      input: {
        year: 2021,
        month: 1,
        day: 2,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "6",
    },
    {
      input: {
        year: 2021,
        month: 1,
        day: 3,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "0",
    },
    {
      input: {
        year: 2021,
        month: 5,
        day: 3,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "1",
    },
    {
      input: {
        year: 2021,
        month: 5,
        day: 7,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "5",
    },
  ];
  tests.forEach((t) => {
    assertEquals(formatDateObj(t.input, "w", defaultLocale), t.expected);
  });
});

Deno.test("format: www", () => {
  const tests = [
    {
      input: {
        year: 2021,
        month: 1,
        day: 2,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "Sat",
    },
    {
      input: {
        year: 2021,
        month: 1,
        day: 3,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "Sun",
    },
    {
      input: {
        year: 2021,
        month: 5,
        day: 3,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "Mon",
    },
    {
      input: {
        year: 2021,
        month: 5,
        day: 7,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "Fri",
    },
  ];
  tests.forEach((t) => {
    assertEquals(formatDateObj(t.input, "www", defaultLocale), t.expected);
  });
});

Deno.test("format: www ja", () => {
  const tests = [
    {
      input: {
        year: 2021,
        month: 1,
        day: 2,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "土",
    },
    {
      input: {
        year: 2021,
        month: 1,
        day: 3,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "日",
    },
    {
      input: {
        year: 2021,
        month: 5,
        day: 3,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "月",
    },
    {
      input: {
        year: 2021,
        month: 5,
        day: 7,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "金",
    },
  ];
  const locale = new Locale("ja");
  tests.forEach((t) => {
    assertEquals(formatDateObj(t.input, "www", locale), t.expected);
  });
});

Deno.test("format: wwww", () => {
  const tests = [
    {
      input: {
        year: 2021,
        month: 1,
        day: 2,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "Saturday",
    },
    {
      input: {
        year: 2021,
        month: 1,
        day: 3,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "Sunday",
    },
    {
      input: {
        year: 2021,
        month: 5,
        day: 3,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "Monday",
    },
    {
      input: {
        year: 2021,
        month: 5,
        day: 7,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "Friday",
    },
  ];
  tests.forEach((t) => {
    assertEquals(formatDateObj(t.input, "wwww", defaultLocale), t.expected);
  });
});

Deno.test("format: wwww ja", () => {
  const tests = [
    {
      input: {
        year: 2021,
        month: 1,
        day: 2,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "土曜日",
    },
    {
      input: {
        year: 2021,
        month: 1,
        day: 3,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "日曜日",
    },
    {
      input: {
        year: 2021,
        month: 5,
        day: 3,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "月曜日",
    },
    {
      input: {
        year: 2021,
        month: 5,
        day: 7,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "金曜日",
    },
  ];
  const locale = new Locale("ja");
  tests.forEach((t) => {
    assertEquals(formatDateObj(t.input, "wwww", locale), t.expected);
  });
});

Deno.test("format: W", () => {
  const tests = [
    {
      input: {
        year: 2021,
        month: 1,
        day: 1,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "53",
    },
    {
      input: {
        year: 2021,
        month: 1,
        day: 4,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "1",
    },
    {
      input: {
        year: 2021,
        month: 5,
        day: 25,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "21",
    },
    {
      input: {
        year: 2021,
        month: 11,
        day: 4,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "44",
    },
    {
      input: {
        year: 2021,
        month: 12,
        day: 31,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "52",
    },
    {
      input: {
        year: 2020,
        month: 12,
        day: 31,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "53",
    },
  ];
  tests.forEach((t) => {
    assertEquals(formatDateObj(t.input, "W", defaultLocale), t.expected);
  });
});

Deno.test("format: WW", () => {
  const tests = [
    {
      input: {
        year: 2021,
        month: 1,
        day: 1,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "53",
    },
    {
      input: {
        year: 2021,
        month: 1,
        day: 4,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "01",
    },
    {
      input: {
        year: 2021,
        month: 5,
        day: 25,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "21",
    },
    {
      input: {
        year: 2021,
        month: 11,
        day: 4,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "44",
    },
    {
      input: {
        year: 2021,
        month: 12,
        day: 31,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "52",
    },
    {
      input: {
        year: 2020,
        month: 12,
        day: 31,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "53",
    },
  ];
  tests.forEach((t) => {
    assertEquals(formatDateObj(t.input, "WW", defaultLocale), t.expected);
  });
});

Deno.test("format: X", () => {
  const tests = [
    {
      input: {
        year: 2021,
        month: 1,
        day: 1,
        hour: 13,
        minute: 30,
        second: 0,
        millisecond: 0,
      },
      expected: "1609507800",
    },
    {
      input: {
        year: 2021,
        month: 1,
        day: 4,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "1609718400",
    },
    {
      input: {
        year: 2021,
        month: 5,
        day: 25,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "1621900800",
    },
  ];
  tests.forEach((t) => {
    assertEquals(formatDateObj(t.input, "X", defaultLocale), t.expected);
  });
});

Deno.test("format: x", () => {
  const tests = [
    {
      input: {
        year: 2021,
        month: 1,
        day: 1,
        hour: 13,
        minute: 30,
        second: 0,
        millisecond: 0,
      },
      expected: "1609507800000",
    },
    {
      input: {
        year: 2021,
        month: 1,
        day: 4,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "1609718400000",
    },
    {
      input: {
        year: 2021,
        month: 5,
        day: 25,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      expected: "1621900800000",
    },
  ];
  tests.forEach((t) => {
    assertEquals(formatDateObj(t.input, "x", defaultLocale), t.expected);
  });
});

Deno.test("format: z", () => {
  const tests = [
    {
      input: {
        year: 2021,
        month: 1,
        day: 1,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      timezone: "Asia/Tokyo",
      expected: "Asia/Tokyo",
    },
    {
      input: {
        year: 2021,
        month: 1,
        day: 4,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      timezone: "America/New_York",
      expected: "America/New_York",
    },
  ];
  tests.forEach((t) => {
    assertEquals(
      formatDateObj(t.input, "z", { timezone: t.timezone as Timezone }),
      t.expected,
    );
  });
});

Deno.test("format: Z", () => {
  const tests = [
    {
      input: {
        year: 2021,
        month: 1,
        day: 1,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      offset: 10800000,
      expected: "+03:00",
    },
    {
      input: {
        year: 2021,
        month: 1,
        day: 4,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      offset: 19800000,
      expected: "+05:30",
    },
    {
      input: {
        year: 2021,
        month: 1,
        day: 4,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      offset: -19800000,
      expected: "-05:30",
    },
  ];
  tests.forEach((t) => {
    assertEquals(
      formatDateObj(t.input, "Z", { offsetMillisec: t.offset }),
      t.expected,
    );
  });
});

Deno.test("format: ZZ", () => {
  const tests = [
    {
      input: {
        year: 2021,
        month: 1,
        day: 1,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      offset: 10800000,
      expected: "+0300",
    },
    {
      input: {
        year: 2021,
        month: 1,
        day: 4,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      offset: 19800000,
      expected: "+0530",
    },
    {
      input: {
        year: 2021,
        month: 1,
        day: 4,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      offset: -19800000,
      expected: "-0530",
    },
  ];
  tests.forEach((t) => {
    assertEquals(
      formatDateObj(t.input, "ZZ", { offsetMillisec: t.offset }),
      t.expected,
    );
  });
});

Deno.test("format: ZZZ", () => {
  type Test = {
    input: DateObj;
    tz?: Timezone;
    locale: string;
    expected: string;
  };

  const tests: Test[] = [
    {
      input: {
        year: 2021,
        month: 1,
        day: 1,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      tz: "Asia/Tokyo",
      locale: "ja",
      expected: "JST",
    },
    {
      input: {
        year: 2021,
        month: 1,
        day: 4,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      tz: "America/New_York",
      locale: "fr",
      expected: "UTC−5",
    },
  ];
  tests.forEach((t) => {
    assertEquals(
      formatDateObj(t.input, "ZZZ", { locale: t.locale, timezone: t.tz }),
      t.expected,
    );
  });
});

Deno.test("format: ZZZZ", () => {
  type Test = {
    input: DateObj;
    tz: Timezone;
    locale: string;
    expected: string;
  };

  const tests: Test[] = [
    {
      input: {
        year: 2021,
        month: 1,
        day: 1,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      tz: "Asia/Tokyo",
      locale: "ja",
      expected: "日本標準時",
    },
    {
      input: {
        year: 2021,
        month: 1,
        day: 4,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      tz: "America/New_York",
      locale: "fr",
      expected: "heure normale de l’Est nord-américain",
    },
    {
      input: {
        year: 2021,
        month: 1,
        day: 4,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      tz: "America/New_York",
      locale: "en",
      expected: "Eastern Standard Time",
    },
  ];
  tests.forEach((t) => {
    assertEquals(
      formatDateObj(t.input, "ZZZZ", { locale: t.locale, timezone: t.tz }),
      t.expected,
    );
  });
});

Deno.test("formatDate", () => {
  type Test = {
    input: DateObj;
    formatStr: string;
    option?: Option;
    expected: string;
  };
  const tests: Test[] = [
    {
      input: {
        year: 2021,
        month: 6,
        day: 1,
        hour: 9,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      formatStr: "MMMM YYYY",
      option: undefined,
      expected: "June 2021",
    },
    {
      input: {
        year: 2021,
        month: 6,
        day: 1,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      formatStr: "x YYYY",
      option: undefined,
      expected: "1622505600000 2021",
    },
    {
      input: {
        year: 2021,
        month: 6,
        day: 1,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      formatStr: "z MMMM",
      option: { timezone: "Asia/Tokyo" },
      expected: "Asia/Tokyo June",
    },
  ];
  tests.forEach((t) => {
    assertEquals(
      formatDate(t.input, t.formatStr, t.option),
      t.expected,
    );
  });
});
