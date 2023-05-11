// Adapted from https://github.com/devbanana/crockford-base32
// Original code is MIT licensed, (c) 2021 Brandon Olivares

const charactersUpper = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const charactersLower = "0123456789abcdefghjkmnpqrstvwxyz";

interface EncodeOptions {
  stripLeadingZeros?: boolean;
  lowerCase?: boolean;
}

type DecodeAsNumberOptions = { asNumber: true } & EncodeOptions;
type DecodeAsBufferOptions = { asNumber?: false } & EncodeOptions;

/**
 * An implementation of the Crockford Base32 algorithm.
 *
 * Spec: https://www.crockford.com/base32.html
 */
export class CrockfordBase32 {
  static encode(
    input: Uint8Array | number | bigint,
    options?: EncodeOptions,
  ): string {
    const characters = options?.lowerCase ? charactersLower : charactersUpper;
    let stripZeros = options?.stripLeadingZeros || false;

    if (input instanceof Uint8Array) {
      // Copy the input buffer so it isn't modified when we call `reverse()`
      input = Uint8Array.from(input);
    } else {
      input = this.createBuffer(input);
      stripZeros = true;
    }

    const output: number[] = [];
    let bitsRead = 0;
    let buffer = 0;

    // Work from the end of the buffer
    input.reverse();

    for (const byte of input) {
      // Add current byte to start of buffer
      buffer |= byte << bitsRead;
      bitsRead += 8;

      while (bitsRead >= 5) {
        output.unshift(buffer & 0x1f);
        buffer >>>= 5;
        bitsRead -= 5;
      }
    }

    if (bitsRead > 0) {
      output.unshift(buffer & 0x1f);
    }

    let dataFound = false;
    return output
      .filter((byte) =>
        stripZeros && !dataFound && byte === 0 ? false : (dataFound = true)
      )
      .map((byte) => characters.charAt(byte))
      .join("");
  }

  static decode(input: string, options: DecodeAsNumberOptions): bigint;
  static decode(input: string, options?: DecodeAsBufferOptions): Uint8Array;
  static decode(
    input: string,
    options?: DecodeAsNumberOptions | DecodeAsBufferOptions,
  ): bigint | Uint8Array {
    // 1. Translate input to all uppercase
    // 2. Translate I, L, and O to valid base 32 characters
    // 3. Remove all hyphens
    input = input
      .toUpperCase()
      .replace(/O/g, "0")
      .replace(/[IL]/g, "1")
      .replace(/-+/g, "");

    // Work from the end
    input = input.split("").reverse().join("");

    const output: number[] = [];
    let bitsRead = 0;
    let buffer = 0;

    for (const character of input) {
      const byte = charactersUpper.indexOf(character);
      if (byte === -1) {
        throw new Error(
          `Invalid base 32 character found in string: ${character}`,
        );
      }

      buffer |= byte << bitsRead;
      bitsRead += 5;

      while (bitsRead >= 8) {
        output.unshift(buffer & 0xff);
        buffer >>>= 8;
        bitsRead -= 8;
      }
    }

    if (bitsRead >= 5 || buffer > 0) {
      output.unshift(buffer & 0xff);
    }

    if (options?.stripLeadingZeros === true) {
      while (output[0] === 0) output.shift();
    }

    if (options?.asNumber === true) {
      return this.asNumber(output);
    }

    return Uint8Array.from(output);
  }

  private static createBuffer(input: number | bigint): Uint8Array {
    if (typeof input === "number") {
      input = BigInt(input);
    }

    if (input < 0n) {
      throw new Error("Input cannot be a negative number");
    }

    const bytes = [];

    while (input > 0n) {
      bytes.unshift(Number(input & 0xffn));
      input >>= 8n;
    }

    return Uint8Array.from(bytes);
  }

  private static asNumber(output: number[]): bigint {
    let outputNumber = 0n;

    output.forEach((byte) => {
      outputNumber <<= 8n;
      outputNumber |= BigInt(byte);
    });

    return outputNumber;
  }
}
