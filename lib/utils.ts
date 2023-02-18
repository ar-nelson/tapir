export async function asyncToArray<T>(iter: AsyncIterable<T>): Promise<T[]> {
  const xs: T[] = [];
  for await (const t of iter) {
    xs.push(t);
  }
  return xs;
}
