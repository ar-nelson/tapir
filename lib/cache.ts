//import { assertEquals } from "$/deps.ts";

/** Circular doubly-linked list, with `FreqListRoot` as the marker element */
type FreqList<K, V> = FreqNode<K, V> | FreqListRoot<K, V>;

/** Circular doubly-linked list, with `FreqNode` as the marker element */
type CacheList<K, V> = CacheNode<K, V> | FreqNode<K, V>;

interface FreqListRoot<K, V> {
  readonly endfn: true;
  nextfn: FreqList<K, V>;
  prevfn: FreqList<K, V>;
}

interface FreqNode<K, V> {
  readonly endfn?: undefined;
  readonly endcn: true;
  priority: number;
  nextcn: CacheList<K, V>;
  prevcn: CacheList<K, V>;
  nextfn: FreqList<K, V>;
  prevfn: FreqList<K, V>;
}

interface CacheNode<K, V> {
  readonly endcn?: undefined;
  key: K;
  value: V;
  hits: number;
  priority: number;
  size?: number;
  fn: FreqNode<K, V>;
  nextcn: CacheList<K, V>;
  prevcn: CacheList<K, V>;
}

export interface LfuCacheOptions<K, V> {
  readonly maxCount?: number;
  readonly maxTotalSize?: number;
  readonly preferredCount?: number;
  readonly preferredTotalSize?: number;
  readonly dynamicAging?: boolean;
  readonly computeSize?: (value: V) => number;
  readonly onEvict?: (key: K, value: V) => void;
}

export class LfuCache<K, V> implements Iterable<[K, V]> {
  #byKey = new Map<K, CacheNode<K, V>>();
  #root: FreqListRoot<K, V>;
  #age = 0;
  #totalSize = 0;
  readonly #maxCount: number;
  readonly #maxTotalSize: number;
  readonly #preferredCount: number;
  readonly #preferredTotalSize: number;
  readonly #dynamicAging: boolean;
  readonly #computeSize?: (value: V) => number;
  readonly #onEvict?: (key: K, value: V) => void;

  constructor(options: LfuCacheOptions<K, V> = {}) {
    const root: Partial<FreqListRoot<K, V>> = { endfn: true };
    root.nextfn = root.prevfn = root as FreqListRoot<K, V>;
    this.#root = root as FreqListRoot<K, V>;

    this.#maxCount = options.maxCount ?? Infinity;
    this.#maxTotalSize = options.maxTotalSize ?? Infinity;
    this.#preferredCount = options.preferredCount ?? options.maxCount ??
      Infinity;
    this.#preferredTotalSize = options.preferredTotalSize ??
      options.maxTotalSize ?? Infinity;
    this.#dynamicAging = options.dynamicAging ?? true;
    this.#computeSize = options.computeSize;
    this.#onEvict = options.onEvict;
  }

  insert(key: K, value: V, hits = 0): void {
    const existing = this.#byKey.get(key);
    if (existing) {
      this.#deleteNode(existing);
    }
    const size = this.#computeSize?.(value);
    this.#evictIfNeeded(size);
    const priority = this.#computePriority({ size, hits }),
      node = { key, value, hits, priority, size };
    this.#byKey.set(key, this.#insertNode(node, this.#root.nextfn));
  }

  get(key: K): V | undefined {
    const node = this.#byKey.get(key);
    if (node) {
      this.#promoteNode(node);
      return node.value;
    }
  }

  getOrInsert(key: K, newValue: () => V): V {
    if (this.#byKey.has(key)) return this.get(key)!;
    const value = newValue();
    this.insert(key, value, 1);
    return value;
  }

  #promoteNode(node: CacheNode<K, V>) {
    const lastPriority = node.priority;
    node.hits++;
    node.priority = Math.max(lastPriority, this.#computePriority(node));
    if (node.priority <= lastPriority) return;
    this.#detachNode(node);
    this.#insertNode(node, node.fn);
  }

  #insertNode(
    partialCn: Omit<CacheNode<K, V>, "fn" | "nextcn" | "prevcn">,
    fn: FreqList<K, V>,
  ): CacheNode<K, V> {
    const cn = partialCn as CacheNode<K, V>;
    if (
      !fn.endfn && fn.nextcn === cn && fn.prevcn === cn &&
      (fn.nextfn.endfn || fn.nextfn.priority > cn.priority)
    ) {
      fn.priority = cn.priority;
      return cn;
    }

    while (!fn.endfn && fn.priority < cn.priority) {
      fn = fn.nextfn;
    }
    if (fn.endfn || fn.priority > cn.priority) {
      // Insert new freq node at this point, with one cache node
      fn.prevfn =
        fn.prevfn.nextfn =
        cn.fn =
        cn.nextcn =
        cn.prevcn =
          {
            endcn: true,
            priority: cn.priority,
            nextcn: cn,
            prevcn: cn,
            nextfn: fn,
            prevfn: fn.prevfn,
          };
    } else {
      //assertEquals(fn.priority, cn.priority);
      // Insert cache node at the end of an existing freq node
      cn.fn = cn.nextcn = fn;
      cn.prevcn = fn.prevcn;
      fn.prevcn = fn.prevcn.nextcn = cn;
    }
    return cn;
  }

  #computePriority(node: { size?: number; hits: number }): number {
    return node.hits / (node.size ?? 1) + (this.#dynamicAging ? this.#age : 0);
  }

  delete(key: K) {
    const node = this.#byKey.get(key);
    if (node) this.#deleteNode(node);
  }

  #deleteNode(node: CacheNode<K, V>) {
    this.#byKey.delete(node.key);
    if (node.size) this.#totalSize -= node.size;
    this.#detachNode(node);
  }

  #detachNode(cn: CacheNode<K, V>) {
    cn.nextcn.prevcn = cn.prevcn;
    cn.prevcn.nextcn = cn.nextcn;
    if (cn.nextcn.endcn && cn.prevcn === cn.nextcn) {
      this.#deleteFreqNode(cn.nextcn);
    }
  }

  #deleteFreqNode(fn: FreqNode<K, V>) {
    fn.nextfn.prevfn = fn.prevfn;
    fn.prevfn.nextfn = fn.nextfn;
  }

  evict(): CacheNode<K, V> | undefined {
    const lastFn = this.#root.nextfn;
    if (!lastFn.endfn) {
      const lastCn = lastFn.nextcn;
      if (!lastCn.endcn) {
        //console.log(
        //  `Evicting item ${lastCn.key} with priority ${lastCn.priority}, fn priority ${lastFn.priority}, hits ${lastCn.hits}, size ${lastCn.size}`,
        //);
        this.#deleteNode(lastCn);
        if (this.#dynamicAging) {
          this.#age = Math.max(this.#age, lastCn.priority);
          //console.log(`Doing dynamic aging: setting age to ${this.#age}`);
        }
        this.#onEvict?.(lastCn.key, lastCn.value);
        return lastCn;
      }
    }
  }

  #evictIfNeeded(addedSize = 0) {
    let totalSize = this.#totalSize + addedSize, count = this.count + 1;
    if (count <= this.#maxCount && totalSize <= this.#maxTotalSize) return;
    while (
      count > this.#preferredCount || totalSize > this.#preferredTotalSize
    ) {
      const evicted = this.evict();
      if (!evicted) return;
      if (evicted.size) totalSize -= evicted.size;
      count--;
    }
  }

  clear() {
    this.#byKey.clear();
    this.#root.nextfn = this.#root.prevfn = this.#root;
  }

  get count(): number {
    return this.#byKey.size;
  }

  get totalSize(): number {
    return this.#totalSize;
  }

  *#nodes() {
    for (let fn = this.#root.nextfn; !fn.endfn; fn = fn.nextfn) {
      for (let cn = fn.nextcn; !cn.endcn; cn = cn.nextcn) {
        yield cn;
      }
    }
  }

  *[Symbol.iterator](): IterableIterator<[K, V]> {
    for (const { key, value } of this.#nodes()) yield [key, value];
  }

  *keys() {
    for (const { key } of this.#nodes()) yield key;
  }

  *values(): Iterator<V> {
    for (const { value } of this.#nodes()) yield value;
  }
}
