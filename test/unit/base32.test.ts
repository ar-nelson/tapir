// Adapted from https://github.com/devbanana/crockford-base32

import { CrockfordBase32 } from "$/lib/base32.ts";
import { toHex } from "$/lib/utils.ts";
import { assertEquals, assertThrows } from "asserts";

Deno.test("can encode a multiple of 5 bits", () => {
  // noinspection SpellCheckingInspection
  assertEquals(
    CrockfordBase32.encode(Uint8Array.from([0xa6, 0xe5, 0x63, 0x34, 0x5f])),
    "MVJP6D2Z",
  );
});

Deno.test("can encode a single byte", () => {
  assertEquals(CrockfordBase32.encode(Uint8Array.from([0x74])), "3M");
});

Deno.test("can encode a large number", () => {
  assertEquals(
    CrockfordBase32.encode(
      Uint8Array.from([0x59, 0x3f, 0x87, 0x59, 0xe8, 0x43, 0x1f, 0x5f]),
    ),
    "5JFW7B7M467TZ",
  );
});

Deno.test("does not strip off leading zeros", () => {
  assertEquals(CrockfordBase32.encode(Uint8Array.from([0, 0, 0xa9])), "00059");
});

Deno.test("can encode a number", () => {
  assertEquals(CrockfordBase32.encode(388_864), "BVR0");
});

Deno.test("can encode a bigint", () => {
  assertEquals(
    CrockfordBase32.encode(10_336_657_440_695_546_835_250_649_691n),
    "8B691DAR2GC0Q2466JV",
  );
});

Deno.test("cannot take a negative number", () => {
  assertThrows(
    () => CrockfordBase32.encode(-323213),
    "Input cannot be a negative number",
  );
});

Deno.test("cannot take a negative bigint", () => {
  assertThrows(
    () => CrockfordBase32.encode(-21233n),
    "Input cannot be a negative number",
  );
});

Deno.test("can encode a UUID into base 32", () => {
  // noinspection SpellCheckingInspection
  assertEquals(
    CrockfordBase32.encode(
      Uint8Array.from([
        0x01,
        0x7c,
        0xb3,
        0xb9,
        0x3b,
        0xcb,
        0x40,
        0xb6,
        0x14,
        0x7d,
        0x78,
        0x13,
        0xc5,
        0xad,
        0x23,
        0x39,
      ]),
    ),
    "01FJSVJEYB82V18ZBR2F2TT8SS",
  );
});

Deno.test("doesn't modify the input buffer", () => {
  const buffer = new TextEncoder().encode("test");
  assertEquals(CrockfordBase32.encode(buffer), "1T6AWVM");
  assertEquals(new TextDecoder().decode(buffer), "test");
});

Deno.test("can strip leading zeros", () => {
  assertEquals(
    CrockfordBase32.encode(Uint8Array.from([0x00, 0x00, 0xa9]), {
      stripLeadingZeros: true,
    }),
    "59",
  );
});

Deno.test("can decode a multiple of 5 bits", () => {
  // noinspection SpellCheckingInspection
  assertEquals(toHex(CrockfordBase32.decode("MVJP6D2Z")), "a6e563345f");
});

Deno.test("can decode a single byte", () => {
  assertEquals(new TextDecoder().decode(CrockfordBase32.decode("3M")), "t");
});

Deno.test("can decode a large number", () => {
  assertEquals(
    toHex(CrockfordBase32.decode("5JFW7B7M467TZ")),
    "593f8759e8431f5f",
  );
});

Deno.test("keeps leading zeros when decoding", () => {
  assertEquals(toHex(CrockfordBase32.decode("00059")), "0000a9");
});

Deno.test("pads to the next byte", () => {
  assertEquals(toHex(CrockfordBase32.decode("M3kV")), "0a0e7b");
});

const table = [
  ["I", "1", "AIm", "2834"],
  ["i", "1", "Aim", "2834"],
  ["L", "1", "ALm", "2834"],
  ["l", "1", "Alm", "2834"],
  ["O", "0", "AOm", "2814"],
  ["o", "0", "Aom", "2814"],
];

Deno.test("translates ambiguous chars when decoding", async (t) => {
  for (const [inputChar, translatedChar, input, output] of table) {
    await t.step(
      `translates ${inputChar} to ${translatedChar} when decoding`,
      () => {
        assertEquals(toHex(CrockfordBase32.decode(input)), output);
      },
    );
  }
});

Deno.test("can decode a ULID", () => {
  // noinspection SpellCheckingInspection
  assertEquals(
    toHex(CrockfordBase32.decode("01FJSVJEYB82V18ZBR2F2TT8SS")),
    "017cb3b93bcb40b6147d7813c5ad2339",
  );
});

Deno.test("can strip leading zeros", () => {
  assertEquals(
    toHex(CrockfordBase32.decode("00059", { stripLeadingZeros: true })),
    "a9",
  );
});

Deno.test("can return a number", () => {
  assertEquals(CrockfordBase32.decode("G3T", { asNumber: true }), 16_506n);
});

Deno.test("rejects any invalid base 32 character", () => {
  assertThrows(
    () => CrockfordBase32.decode("T&ZQ"),
    "Invalid base 32 character found in string: &",
  );
});

Deno.test("ignores hyphens", () => {
  // noinspection SpellCheckingInspection
  assertEquals(
    new TextDecoder().decode(CrockfordBase32.decode("3KDXPP-A83KEH-S6JVK7")),
    "some string",
  );
});

Deno.test("ignores multiple adjacent hyphens", () => {
  // noinspection SpellCheckingInspection
  assertEquals(
    new TextDecoder().decode(CrockfordBase32.decode("3KDXPP--A83KEH---S6JVK7")),
    "some string",
  );
});
