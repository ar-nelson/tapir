// deno-lint-ignore-file no-explicit-any

class LiftedTransformer<I, O, R> implements AsyncTransformer<I, O, R> {
  constructor(private readonly xf: Transformer<I, O, R>) {}
  init() {
    return this.xf.init();
  }
  result(result: O) {
    return Promise.resolve(this.xf.result(result));
  }
  step(result: O, input: I) {
    return Promise.resolve(this.xf.step(result, input));
  }
  readonly isAsync = true;
}

export function toAsync<I, O, R>(
  xf: Transformer<I, O, R>,
): AsyncTransformer<I, O, R> {
  return new LiftedTransformer(xf);
}

export interface Transformer<in I, O, out R = O> {
  init(): O;
  result(result: O): R;
  step(result: O, input: I): O;
  readonly isAsync?: false;
}

export interface AsyncTransformer<in I, O, out R = O> {
  init(): O;
  result(result: O): Promise<R>;
  step(result: O, input: I): Promise<O>;
  readonly isAsync: true;
}

export type Transducer<I, O> = <T, R>(
  xf: Transformer<O, T, R>,
) => Transformer<I, T, R>;

export type AsyncTransducer<I, O> = <T, R>(
  xf: Transformer<O, T, R> | AsyncTransformer<O, T, R>,
) => AsyncTransformer<I, T, R>;

type Fn<A, B> = (a: A) => B;

export const comp =
  <B, C>(f: Fn<B, C>): <A>(g: Fn<A, B>) => Fn<A, C> => (g) => (a) => f(g(a));

export interface SyncTransducerBuilder<T> {
  pipe<U>(xf: Transducer<T, U>): SyncTransducerBuilder<U>;
  collect<U, R>(xf: Transformer<T, U, R>): R;

  map<U>(f: (x: T) => U): SyncTransducerBuilder<U>;

  flatMap<U>(f: (x: T) => Iterable<U>): SyncTransducerBuilder<U>;

  filter<U extends T>(f: (x: T) => x is U): SyncTransducerBuilder<U>;
  filter(f: (x: T) => boolean): SyncTransducerBuilder<T>;

  notNull(): SyncTransducerBuilder<NonNullable<T>>;

  take(n: number): SyncTransducerBuilder<T>;
  takeWhile<U extends T>(f: (x: T) => x is U): SyncTransducerBuilder<U>;
  takeWhile(f: (x: T) => boolean): SyncTransducerBuilder<T>;

  drop(n: number): SyncTransducerBuilder<T>;
  dropWhile(f: (x: T) => boolean): SyncTransducerBuilder<T>;

  unique(key?: (x: T) => unknown): SyncTransducerBuilder<T>;
  chunk(size: number): SyncTransducerBuilder<T[]>;

  first(strict?: boolean): T;
  toArray(): T[];
  toSet(): Set<T>;
  toPartitionMap<K>(discriminator: (x: T) => K): Map<K, T[]>;
  reduce<U>(f: (u: U, t: T) => U, init: U): U;
  fold(f: (a: T, b: T) => T): T;
  foreach(f: (x: T) => void): void;
  count(): number;
}

export interface AsyncTransducerBuilder<T> {
  pipe<U>(
    xf: Transducer<T, U> | AsyncTransducer<T, U>,
  ): AsyncTransducerBuilder<U>;
  collect<U, R>(
    xf: Transformer<T, U, R> | AsyncTransformer<T, U, R>,
  ): Promise<R>;

  map<U>(f: (x: T) => U): AsyncTransducerBuilder<U>;
  mapAsync<U>(f: (x: T) => Promise<U>): AsyncTransducerBuilder<U>;

  flatMap<U>(f: (x: T) => Iterable<U>): AsyncTransducerBuilder<U>;
  flatMapAsync<U>(
    f: (
      x: T,
    ) => AsyncIterable<U> | Promise<Iterable<U>> | Promise<AsyncIterable<U>>,
  ): AsyncTransducerBuilder<U>;

  filter<U extends T>(f: (x: T) => x is U): AsyncTransducerBuilder<U>;
  filter(f: (x: T) => boolean): AsyncTransducerBuilder<T>;
  filterAsync(f: (x: T) => Promise<boolean>): AsyncTransducerBuilder<T>;

  notNull(): AsyncTransducerBuilder<NonNullable<T>>;

  take(n: number): AsyncTransducerBuilder<T>;
  takeWhile<U extends T>(f: (x: T) => x is U): AsyncTransducerBuilder<U>;
  takeWhile(f: (x: T) => boolean): AsyncTransducerBuilder<T>;

  drop(n: number): AsyncTransducerBuilder<T>;
  dropWhile(f: (x: T) => boolean): AsyncTransducerBuilder<T>;

  unique(key?: (x: T) => unknown): AsyncTransducerBuilder<T>;
  chunk(size: number): AsyncTransducerBuilder<T[]>;

  first(strict?: boolean): Promise<T>;
  toArray(): Promise<T[]>;
  toSet(): Promise<Set<T>>;
  toPartitionMap<K>(discriminator: (x: T) => K): Promise<Map<K, T[]>>;
  reduce<U>(f: (u: U, t: T) => U, init: U): Promise<U>;
  fold(f: (a: T, b: T) => T): Promise<T>;
  foreach(f: (x: T) => void): Promise<void>;
  foreachAsync(f: (x: T) => Promise<void>): Promise<void>;
  count(): Promise<number>;
}

export interface RootTransducerBuilder<T> extends SyncTransducerBuilder<T> {
  pipe<U>(xf: Transducer<T, U>): SyncTransducerBuilder<U>;
  pipe<U>(xf: AsyncTransducer<T, U>): AsyncTransducerBuilder<U>;
  collect<U, R>(xf: Transformer<T, U, R>): R;
  collect<U, R>(xf: AsyncTransformer<T, U, R>): Promise<R>;

  liftAsync(): AsyncTransducerBuilder<T>;

  mapAsync<U>(f: (x: T) => Promise<U>): AsyncTransducerBuilder<U>;

  flatMapAsync<U>(
    f: (
      x: T,
    ) => AsyncIterable<U> | Promise<Iterable<U>> | Promise<AsyncIterable<U>>,
  ): AsyncTransducerBuilder<U>;

  filterAsync(f: (x: T) => Promise<boolean>): AsyncTransducerBuilder<T>;

  foreachAsync(f: (x: T) => Promise<void>): Promise<void>;
}

export abstract class AbstractTransducerBuilder<T>
  implements RootTransducerBuilder<T> {
  protected isAsync = false;
  #transducer: Transducer<T, any> | AsyncTransducer<T, any> | undefined =
    undefined;

  pipe<U>(
    xf: Transducer<T, U> | AsyncTransducer<T, U>,
  ): SyncTransducerBuilder<U> & AsyncTransducerBuilder<U> {
    const xf0 = this.#transducer;
    if (xf0) this.#transducer = (a: any) => xf0((xf as any)(a)) as any;
    else this.#transducer = xf;
    return this as any;
  }

  collect<U, R>(
    xf: Transformer<T, U, R> | AsyncTransformer<T, U, R>,
  ): R & Promise<R> {
    const transducer = this.#transducer ? this.#transducer(xf as any) : xf;
    if (transducer.isAsync) {
      return this.transduceAsync(transducer) as R & Promise<R>;
    } else return this.transduceSync(transducer) as R & Promise<R>;
  }

  protected abstract transduceSync<U, R>(
    xf: Transformer<T, U, R>,
  ): R | Promise<R>;

  protected abstract transduceAsync<U, R>(
    xf: AsyncTransformer<T, U, R>,
  ): Promise<R>;

  liftAsync(): AsyncTransducerBuilder<T> {
    return this.pipe(liftAsync());
  }

  map<U>(f: (x: T) => U): SyncTransducerBuilder<U> {
    return this.pipe(map(f));
  }
  mapAsync<U>(f: (x: T) => Promise<U>): AsyncTransducerBuilder<U> {
    this.isAsync = true;
    return this.pipe(mapAsync(f));
  }

  flatMap<U>(f: (x: T) => Iterable<U>): SyncTransducerBuilder<U> {
    return this.pipe(flatMap(f));
  }
  flatMapAsync<U>(
    f: (
      x: T,
    ) => AsyncIterable<U> | Promise<Iterable<U>> | Promise<AsyncIterable<U>>,
  ): AsyncTransducerBuilder<U> {
    return this.pipe(flatMapAsync(f));
  }

  filter<U extends T>(f: (x: T) => x is U): SyncTransducerBuilder<U>;
  filter(f: (x: T) => boolean): SyncTransducerBuilder<T>;
  filter(f: (x: T) => boolean): SyncTransducerBuilder<T> {
    return this.pipe(filter(f));
  }
  filterAsync(f: (x: T) => Promise<boolean>): AsyncTransducerBuilder<T> {
    return this.pipe(filterAsync(f));
  }

  notNull(): SyncTransducerBuilder<NonNullable<T>> {
    return this.pipe(filter((x) => x != null)) as SyncTransducerBuilder<
      NonNullable<T>
    >;
  }

  take(n: number): SyncTransducerBuilder<T> {
    return this.pipe(take(n));
  }
  takeWhile<U extends T>(f: (x: T) => x is U): SyncTransducerBuilder<U>;
  takeWhile(f: (x: T) => boolean): SyncTransducerBuilder<T>;
  takeWhile(f: (x: T) => boolean): SyncTransducerBuilder<T> {
    return this.pipe(takeWhile(f));
  }

  drop(n: number): SyncTransducerBuilder<T> {
    return this.pipe(drop(n));
  }
  dropWhile(f: (x: T) => boolean): SyncTransducerBuilder<T> {
    return this.pipe(dropWhile(f));
  }

  unique(key?: (x: T) => unknown): SyncTransducerBuilder<T> {
    return this.pipe(unique(key));
  }
  chunk(size: number): SyncTransducerBuilder<T[]> {
    return this.pipe(chunk(size));
  }

  first(strict?: boolean): T {
    return this.collect(first(strict));
  }
  toArray(): T[] {
    return this.collect(toArray());
  }
  toSet(): Set<T> {
    return this.collect(toSet());
  }
  toPartitionMap<K>(
    discriminator: (x: T) => K,
  ): Map<K, T[]> {
    return this.collect(toPartitionMap(discriminator));
  }
  reduce<U>(f: (u: U, t: T) => U, init: U): U {
    return this.collect(reduce(f, init));
  }
  fold(f: (a: T, b: T) => T): T {
    return this.collect(fold(f));
  }
  foreach(f: (x: T) => void): void {
    return this.collect(foreach(f));
  }
  foreachAsync(f: (x: T) => Promise<void>): Promise<void> {
    return this.collect(foreachAsync(f));
  }
  count(): number {
    return this.collect(count());
  }
}

class IterableTransducer<T> extends AbstractTransducerBuilder<T> {
  constructor(private readonly iter: Iterable<T>) {
    super();
  }

  protected transduceSync<U, R>(xf: Transformer<T, U, R>): R {
    let a = xf.init();
    for (const el of this.iter) a = xf.step(a, el);
    return xf.result(a);
  }

  protected async transduceAsync<U, R>(
    xf: AsyncTransformer<T, U, R>,
  ): Promise<R> {
    let a = xf.init();
    for (const el of this.iter) a = await xf.step(a, el);
    return xf.result(a);
  }
}

class AsyncIterableTransducer<T> extends AbstractTransducerBuilder<T> {
  constructor(private readonly iter: AsyncIterable<T>) {
    super();
  }

  protected transduceSync<U, R>(xf: Transformer<T, U, R>): Promise<R> {
    return this.transduceAsync(toAsync(xf));
  }

  protected async transduceAsync<U, R>(
    xf: AsyncTransformer<T, U, R>,
  ): Promise<R> {
    let a = xf.init();
    for await (const el of this.iter) a = await xf.step(a, el);
    return xf.result(a);
  }
}

export function chainFrom<T>(iter: Iterable<T>): RootTransducerBuilder<T>;
export function chainFrom<T>(iter: AsyncIterable<T>): AsyncTransducerBuilder<T>;
export function chainFrom<T>(
  iter: Iterable<T> | AsyncIterable<T>,
): RootTransducerBuilder<T> | AsyncTransducerBuilder<T> {
  if (Symbol.asyncIterator in iter) {
    return new AsyncIterableTransducer(iter as AsyncIterable<T>);
  } else return new IterableTransducer(iter as Iterable<T>);
}

export const identity = <I>(): Transducer<I, I> => (x) => x;

export const liftAsync = <I>(): AsyncTransducer<I, I> => (x) =>
  x.isAsync ? x : toAsync(x);

export function stepTransducer<I, O>(
  step: <T, R>(this: Transformer<O, T, R>, result: T, input: I) => T,
): Transducer<I, O> {
  return <T, R>(xf: Transformer<O, T, R>) => ({
    init() {
      return xf.init();
    },
    result(o: T) {
      return xf.result(o);
    },
    step: step.bind(xf) as (result: T, input: I) => T,
  });
}

export const map = <I, O>(f: (i: I) => O) =>
  stepTransducer<I, O>(function (result, input) {
    return this.step(result, f(input));
  });

export const flatMap = <I, O>(f: (i: I) => Iterable<O>) =>
  stepTransducer<I, O>(function (result, input) {
    for (const i of f(input)) result = this.step(result, i);
    return result;
  });

export function filter<I, O extends I>(f: (i: I) => i is O): Transducer<I, O>;
export function filter<I>(f: (i: I) => boolean): Transducer<I, I>;
export function filter<I>(f: (i: I) => boolean): Transducer<I, I> {
  return stepTransducer(function (result, input) {
    return f(input) ? this.step(result, input) : result;
  });
}

export function take<I>(n: number): Transducer<I, I> {
  return (xf) => {
    let nn = n;
    return stepTransducer<I, I>(function (result, input) {
      if (nn > 0) {
        result = this.step(result, input);
        nn--;
      }
      return result;
    })(xf);
  };
}

export function drop<I>(n: number): Transducer<I, I> {
  return (xf) => {
    let nn = n;
    return stepTransducer<I, I>(function (result, input) {
      if (nn > 0) {
        nn--;
        return result;
      }
      return this.step(result, input);
    })(xf);
  };
}

export function takeWhile<I>(f: (i: I) => boolean): Transducer<I, I> {
  return (xf) => {
    let done = false;
    return stepTransducer<I, I>(function (result, input) {
      if (done) return result;
      if (f(input)) return this.step(result, input);
      done = true;
      return result;
    })(xf);
  };
}

export function dropWhile<I>(f: (i: I) => boolean): Transducer<I, I> {
  return (xf) => {
    let done = false;
    return stepTransducer<I, I>(function (result, input) {
      if (done) return this.step(result, input);
      if (f(input)) return result;
      done = true;
      return this.step(result, input);
    })(xf);
  };
}

export function unique<I>(key: (i: I) => unknown = (x) => x): Transducer<I, I> {
  return (xf) => {
    const seen = new Set<unknown>();
    return stepTransducer<I, I>(function (result, input) {
      const k = key(input);
      if (seen.has(k)) return result;
      seen.add(k);
      return this.step(result, input);
    })(xf);
  };
}

export function chunk<I>(size: number): Transducer<I, I[]> {
  return <T, R>(xf: Transformer<I[], T, R>) => {
    let chunk: I[] = [];
    return {
      init() {
        return xf.init();
      },
      result(result: T): R {
        if (chunk.length) return xf.result(xf.step(result, chunk));
        return xf.result(result);
      },
      step(result: T, input: I): T {
        chunk.push(input);
        if (chunk.length >= size) {
          result = xf.step(result, chunk);
          chunk = [];
        }
        return result;
      },
    };
  };
}

const uninitialized: unique symbol = Symbol();

export function first<T>(
  strict = false,
): Transformer<T, T | typeof uninitialized, T> {
  return {
    init() {
      return uninitialized;
    },
    result(result: T | typeof uninitialized): T {
      if (result === uninitialized) {
        throw new Error("expected exactly one result, got zero");
      }
      return result;
    },
    step(result: T | typeof uninitialized, input: T) {
      if (result === uninitialized) return input;
      if (strict) {
        throw new Error("expected exactly one result, got more than one");
      }
      return result;
    },
  };
}

export function reduce<I, O>(
  step: (result: O, input: I) => O,
  init: O,
): Transformer<I, O> {
  return {
    init: () => init,
    result: (r) => r,
    step,
  };
}

export function fold<T>(
  step: (a: T, b: T) => T,
): Transformer<T, T | typeof uninitialized, T> {
  return {
    init() {
      return uninitialized;
    },
    result(result: T | typeof uninitialized): T {
      if (result === uninitialized) {
        throw new Error("fold requires at least one iterable item");
      }
      return result;
    },
    step(result: T | typeof uninitialized, input: T) {
      if (result === uninitialized) return input;
      return step(result, input);
    },
  };
}

export function foreach<T>(
  f: (x: T) => void,
): Transformer<T, void, void> {
  return {
    init() {},
    result() {},
    step(_result: void, input: T) {
      f(input);
    },
  };
}

export function foreachAsync<T>(
  f: (x: T) => Promise<void>,
): AsyncTransformer<T, void, void> {
  return {
    init() {},
    result() {
      return Promise.resolve();
    },
    async step(_result: void, input: T) {
      await f(input);
    },
    isAsync: true,
  };
}

export function toArray<I>(): Transformer<I, I[]> {
  return reduce<I, I[]>(
    (xs, x) => {
      xs.push(x);
      return xs;
    },
    [],
  );
}

export function toSet<I>(): Transformer<I, Set<I>> {
  return reduce<I, Set<I>>(
    (xs, x) => {
      xs.add(x);
      return xs;
    },
    new Set(),
  );
}

export function toObject<V>(): Transformer<
  readonly [string, V],
  Record<string, V>
>;
export function toObject<K extends string | number | symbol, V>(): Transformer<
  readonly [K, V],
  Partial<Record<K, V>>
>;
export function toObject<K extends string | number | symbol, V>(): Transformer<
  readonly [K, V],
  Partial<Record<K, V>>
> {
  return reduce<readonly [K, V], Partial<Record<K, V>>>(
    (xs, [k, v]) => {
      xs[k] = v;
      return xs;
    },
    Object.create(null),
  );
}

export function toMap<K, V>(): Transformer<readonly [K, V], Map<K, V>> {
  return reduce<readonly [K, V], Map<K, V>>(
    (xs, [k, v]) => {
      xs.set(k, v);
      return xs;
    },
    new Map(),
  );
}

export function toPartitionMap<K, V>(
  discriminator: (v: V) => K,
): Transformer<V, Map<K, V[]>> {
  return reduce<V, Map<K, V[]>>(
    (xs, x) => {
      const k = discriminator(x), existing = xs.get(k);
      if (existing) existing.push(x);
      else xs.set(k, [x]);
      return xs;
    },
    new Map(),
  );
}

export function stepTransducerAsync<I, O>(
  step: <T, R>(
    this: AsyncTransformer<O, T, R>,
    result: T,
    input: I,
  ) => Promise<T>,
): AsyncTransducer<I, O> {
  return <T, R>(
    xf0: Transformer<O, T, R> | AsyncTransformer<O, T, R>,
  ) => {
    const xf = xf0.isAsync ? xf0 : toAsync(xf0);
    return {
      init() {
        return xf.init();
      },
      result(o: T) {
        return xf.result(o);
      },
      step: step.bind(xf) as (result: T, input: I) => Promise<T>,
      isAsync: true,
    };
  };
}

export const mapAsync = <I, O>(f: (i: I) => Promise<O>) =>
  stepTransducerAsync<I, O>(async function (result, input) {
    return this.step(result, await f(input));
  });

export const flatMapAsync = <I, O>(
  f: (
    i: I,
  ) => AsyncIterable<O> | Promise<Iterable<O>> | Promise<AsyncIterable<O>>,
) =>
  stepTransducerAsync<I, O>(async function (result, input) {
    for await (const i of await f(input)) result = await this.step(result, i);
    return result;
  });

export function filterAsync<I>(
  f: (i: I) => Promise<boolean>,
): AsyncTransducer<I, I> {
  return stepTransducerAsync(async function (result, input) {
    return await f(input) ? this.step(result, input) : result;
  });
}

export function count<T>(): Transformer<T, number> {
  return reduce((n) => n + 1, 0);
}
