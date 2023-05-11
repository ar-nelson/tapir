import { crypto_argon2i } from "$/deps.ts";

export function asArray<T extends string | URL | Record<string, unknown>>(
  x: undefined | null | T | readonly T[],
): readonly T[] {
  if (!x) return [];
  if (Array.isArray(x)) return x;
  return [x as T];
}

export function mapObject<T extends Record<string, U>, U, V>(
  obj: T,
  fn: <K extends keyof T & string>(k: K, v: T[K]) => V,
): { [K in keyof T & string]: V } {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, fn(k, v as any)]),
  ) as { [K in keyof T & string]: V };
}

export async function fileExists(path: string): Promise<boolean> {
  try {
    return (await Deno.stat(path)).isFile;
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) {
      return false;
    }
    throw e;
  }
}

export function fileExistsSync(path: string): boolean {
  try {
    return Deno.statSync(path).isFile;
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) {
      return false;
    }
    throw e;
  }
}

export async function dirExists(path: string): Promise<boolean> {
  try {
    return (await Deno.stat(path)).isDirectory;
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) {
      return false;
    }
    throw e;
  }
}

export function dirExistsSync(path: string): boolean {
  try {
    return Deno.statSync(path).isDirectory;
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) {
      return false;
    }
    throw e;
  }
}

export function isPersonaName(name: string): boolean {
  return /^[\w-.]{1,64}$/.test(name);
}

export function checkPersonaName(name: string): void {
  if (!isPersonaName(name)) {
    throw new Error(
      `${
        JSON.stringify(name)
      } is not a legal persona name. A persona name must be 1-64 alphanumeric characters (including -, _, or .).`,
    );
  }
}

export function hashPassword(password: string, salt: Uint8Array): Uint8Array {
  return crypto_argon2i(
    32,
    32000,
    3,
    new TextEncoder().encode(password),
    salt,
  );
}

export function binaryEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) {
    return false;
  }
  return a.every((n, i) => b[i] === n);
}

export function toHex(bin: Uint8Array): string {
  return bin.reduce(
    (s, byte) => `${s}${byte.toString(16).padStart(2, "0")}`,
    "",
  );
}

export type AssertFn<T> = (
  value: unknown,
  message?: string,
) => asserts value is T;

export async function* mapAsyncIterable<T, U>(
  iter: AsyncIterable<T>,
  fn: (x: T) => U,
): AsyncIterable<Awaited<U>> {
  for await (const x of iter) {
    yield await fn(x);
  }
}
