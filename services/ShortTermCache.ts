import { Injectable, InjectableAbstract } from "$/lib/inject.ts";

@InjectableAbstract()
export abstract class ShortTermCache<T> {
  abstract get(key: string): T | undefined;
  abstract getOrSet(key: string, set: () => T): T;
  abstract set(key: string, value: T): void;
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
