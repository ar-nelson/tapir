import { Injectable, InjectableAbstract } from "$/lib/inject.ts";

@InjectableAbstract()
export abstract class ShortTermCache<T> {
  abstract get(key: string): T | undefined;
  abstract getOrSet(key: string, set: () => T): T;
  abstract set(key: string, value: T): void;
}

@InjectableAbstract()
export abstract class LongTermCache<T> {
  abstract get(key: string): Promise<T | undefined>;
  getOrSet(key: string, set: () => T): Promise<T> {
    return this.getOrSetAsync(key, () => Promise.resolve(set()));
  }
  abstract getOrSetAsync(key: string, set: () => Promise<T>): Promise<T>;
  abstract set(key: string, value: T): Promise<void>;
}

@Injectable(ShortTermCache)
export class InMemoryShortTermCache<T> extends ShortTermCache<T> {
  private map = new Map<string, T>();

  get(key: string): T | undefined {
    return this.map.get(key);
  }

  getOrSet(key: string, set: () => T): T {
    if (this.map.has(key)) {
      return this.map.get(key)!;
    }
    const newValue = set();
    this.map.set(key, newValue);
    return newValue;
  }

  set(key: string, value: T): void {
    this.map.set(key, value);
  }
}

@Injectable(LongTermCache)
export class InMemoryLongTermCache<T> extends LongTermCache<T> {
  private map = new Map<string, Promise<T>>();

  get(key: string): Promise<T | undefined> {
    return this.map.get(key) ?? Promise.resolve(undefined);
  }

  getOrSetAsync(key: string, set: () => Promise<T>): Promise<T> {
    if (this.map.has(key)) {
      return this.map.get(key)!;
    }
    const newValue = set();
    this.map.set(key, newValue);
    return newValue;
  }

  set(key: string, value: T): Promise<void> {
    this.map.set(key, Promise.resolve(value));
    return Promise.resolve();
  }
}
