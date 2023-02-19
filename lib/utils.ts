export async function asyncToArray<T>(iter: AsyncIterable<T>): Promise<T[]> {
  const xs: T[] = [];
  for await (const t of iter) {
    xs.push(t);
  }
  return xs;
}

export function mapObject<T extends Record<string, U>, U, V>(
  obj: T,
  fn: <K extends keyof T>(k: K, v: T[K]) => V,
): { [K in keyof T]: V } {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, fn(k, v as any)]),
  ) as { [K in keyof T]: V };
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
