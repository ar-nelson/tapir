import { LogLevels, Tag } from "$/lib/error.ts";
import { InjectableAbstract, Singleton } from "$/lib/inject.ts";
import {
  AsyncTransducerBuilder,
  chainFrom,
  RootTransducerBuilder,
  SyncTransducerBuilder,
} from "$/lib/transducers.ts";
import {
  ProfileFeed,
  ProtoAddr,
  Protocol,
  RemotePostFull,
  RemoteProfileFull,
  RemoteReaction,
} from "$/models/types.ts";
import { Priority } from "$/services/HttpDispatcher.ts";

export interface Page<out T> {
  readonly nextCursor?: string;
  readonly items: readonly T[];
}

export class PageStream<T> implements AsyncIterable<T> {
  constructor(public readonly page: (cursor?: string) => Promise<Page<T>>) {}

  async *[Symbol.asyncIterator]() {
    for (
      let pg = await this.page();
      pg.nextCursor;
      pg = await this.page(pg.nextCursor)
    ) {
      for (const i of pg.items) yield i;
    }
  }

  mapPages<U>(f: (page: Page<T>) => Promise<Page<U>>): PageStream<U> {
    return new PageStream<U>(async (c) => {
      let pg = await f(await this.page(c));
      while (!pg.items.length && pg.nextCursor != null) {
        pg = await f(await this.page(pg.nextCursor));
      }
      return pg;
    });
  }

  transducePages<U>(
    f: (
      xf: RootTransducerBuilder<T>,
    ) => SyncTransducerBuilder<U> | AsyncTransducerBuilder<U>,
  ): PageStream<U> {
    return this.mapPages(async ({ items, nextCursor }) => ({
      items: await f(chainFrom(items)).toArray(),
      nextCursor,
    }));
  }

  mapItems<U>(f: (item: T, cursor?: string) => U): PageStream<U> {
    return new PageStream(
      async (c) => {
        const { items, nextCursor } = await this.page(c);
        return { items: items.map((i) => f(i, c)), nextCursor };
      },
    );
  }

  mapItemsAsync<U>(
    f: (item: T, cursor?: string) => Promise<U>,
  ): PageStream<U> {
    return new PageStream(
      async (c) => {
        const { items, nextCursor } = await this.page(c);
        return {
          items: await Promise.all(items.map((i) => f(i, c))),
          nextCursor,
        };
      },
    );
  }
}

export class FinitePageStream<out T> extends PageStream<T> {
  static empty(): FinitePageStream<never> {
    return new FinitePageStream(() => Promise.resolve({ items: [] }), 0);
  }

  static of<T>(iter: Iterable<T>, pageSize?: number): FinitePageStream<T> {
    const items = [...iter];
    if (!pageSize) {
      return new FinitePageStream(
        () => Promise.resolve({ items }),
        items.length,
      );
    }
    return new IterableFinitePageStream(items, pageSize, items.length);
  }

  constructor(
    page: (cursor?: string) => Promise<Page<T>>,
    public readonly totalItems: number,
  ) {
    super(page);
  }

  mapItems<U>(f: (item: T, cursor?: string) => U): FinitePageStream<U> {
    return new FinitePageStream(super.mapItems(f).page, this.totalItems);
  }

  mapItemsAsync<U>(
    f: (item: T, cursor?: string) => Promise<U>,
  ): FinitePageStream<U> {
    return new FinitePageStream(super.mapItemsAsync(f).page, this.totalItems);
  }
}

export class IterableFinitePageStream<out T> extends FinitePageStream<T> {
  #history: T[] = [];

  constructor(
    iterable: AsyncIterable<T> | Iterable<T>,
    pageSize: number,
    totalItems: number,
  ) {
    const iter = ((iterable as AsyncIterable<T>)[Symbol.asyncIterator] ??
      (iterable as Iterable<T>)[Symbol.iterator])();
    super(
      async (cursor = "0") => {
        const start = +cursor,
          items: T[] = [];
        for (let i = start; i < start + pageSize; i++) {
          if (i < this.#history.length) {
            items.push(this.#history[i]);
          } else {
            const result = await iter.next();
            if (!result.done || result.value != null) {
              items.push(result.value);
              this.#history.push(result.value);
            }
            if (result.done) {
              return { items };
            }
          }
        }
        return { items, nextCursor: `${start + pageSize}` };
      },
      totalItems,
    );
  }
}

export const UnsupportedProtocol = new Tag("Unsupported Protocol", {
  level: LogLevels.WARNING,
  needsStackTrace: false,
});

export abstract class RemoteFetcher<Addr> {
  abstract fetchProfile(
    profileAddr: Addr,
    priority?: Priority,
  ): Promise<RemoteProfileFull>;
  abstract fetchFollowers(
    profileAddr: Addr,
    priority?: Priority,
  ): Promise<FinitePageStream<ProtoAddr>>;
  abstract fetchFollowing(
    profileAddr: Addr,
    priority?: Priority,
  ): Promise<FinitePageStream<ProtoAddr>>;
  abstract fetchProfileFeed(
    profileAddr: Addr,
    feed?: ProfileFeed,
    priority?: Priority,
  ): Promise<PageStream<ProtoAddr | RemotePostFull>>;

  abstract fetchPost(
    postAddr: Addr,
    priority?: Priority,
  ): Promise<RemotePostFull>;
  abstract fetchReplies(
    postAddr: Addr,
    priority?: Priority,
  ): Promise<FinitePageStream<ProtoAddr | RemotePostFull>>;
  abstract fetchReactions(
    postAddr: Addr,
    priority?: Priority,
  ): Promise<FinitePageStream<RemoteReaction>>;
  abstract fetchBoosts(
    postAddr: Addr,
    priority?: Priority,
  ): Promise<FinitePageStream<ProtoAddr | RemotePostFull>>;
  abstract fetchFeed(
    feedAddr: Addr,
    priority?: Priority,
  ): Promise<PageStream<ProtoAddr | RemotePostFull>>;
}

@InjectableAbstract()
export abstract class LocalFetcher extends RemoteFetcher<string> {}

@InjectableAbstract()
export abstract class ActivityPubFetcher extends RemoteFetcher<string> {}

@InjectableAbstract()
export abstract class RemoteFetcherService extends RemoteFetcher<ProtoAddr> {}

@Singleton(RemoteFetcherService)
export class RemoteFetcherServiceImpl extends RemoteFetcherService {
  readonly #protocols: Partial<Record<Protocol, RemoteFetcher<string>>>;

  constructor(
    localFetcher: LocalFetcher,
    activityPubFetcher: ActivityPubFetcher,
  ) {
    super();
    this.#protocols = {
      [Protocol.Local]: localFetcher,
      [Protocol.ActivityPub]: activityPubFetcher,
    };
  }

  #fetcher(protocol: Protocol): RemoteFetcher<string> {
    const fetcher = this.#protocols[protocol];
    if (fetcher == null) throw UnsupportedProtocol.error(protocol);
    return fetcher;
  }

  async fetchProfile({ protocol, path }: ProtoAddr, priority?: Priority) {
    return await this.#fetcher(protocol).fetchProfile(path, priority);
  }
  async fetchFollowers({ protocol, path }: ProtoAddr, priority?: Priority) {
    return await this.#fetcher(protocol).fetchFollowers(path, priority);
  }
  async fetchFollowing({ protocol, path }: ProtoAddr, priority?: Priority) {
    return await this.#fetcher(protocol).fetchFollowing(path, priority);
  }
  async fetchProfileFeed(
    { protocol, path }: ProtoAddr,
    feed?: ProfileFeed,
    priority?: Priority,
  ) {
    return await this.#fetcher(protocol).fetchProfileFeed(path, feed, priority);
  }

  async fetchPost({ protocol, path }: ProtoAddr, priority?: Priority) {
    return await this.#fetcher(protocol).fetchPost(path, priority);
  }
  async fetchReplies({ protocol, path }: ProtoAddr, priority?: Priority) {
    return await this.#fetcher(protocol).fetchReplies(path, priority);
  }
  async fetchReactions({ protocol, path }: ProtoAddr, priority?: Priority) {
    return await this.#fetcher(protocol).fetchReactions(path, priority);
  }
  async fetchBoosts({ protocol, path }: ProtoAddr, priority?: Priority) {
    return await this.#fetcher(protocol).fetchBoosts(path, priority);
  }
  async fetchFeed({ protocol, path }: ProtoAddr, priority?: Priority) {
    return await this.#fetcher(protocol).fetchFeed(path, priority);
  }
}
