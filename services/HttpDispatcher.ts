import { InjectableAbstract, Singleton } from "$/lib/inject.ts";
import { PriorityQueue } from "$/lib/priorityQueue.ts";
import { DateTime } from "$/lib/datetime/mod.ts";
import { BlockedServerStoreReadOnly } from "$/models/BlockedServerStoreReadOnly.ts";
import { HttpClientService } from "$/services/HttpClientService.ts";
import { Reschedule, SchedulerService } from "$/services/SchedulerService.ts";
import { isErrorStatus, isHttpError, log, Status } from "$/deps.ts";

export enum Priority {
  Spaced,
  Optional,
  Eventually,
  Soon,
  Immediate,
}

enum State {
  Initializing,
  Pending,
  Completed,
  Canceled,
}

@InjectableAbstract()
export abstract class HttpDispatcher {
  abstract dispatch(
    request: Request,
    priority: Priority,
  ): {
    cancel: () => void;
    response: Promise<Response>;
    dispatched: Promise<void>;
  };

  abstract dispatchInOrder(
    requests: Request[],
    priority: Priority,
  ): {
    cancel: () => void;
    responses: AsyncIterable<Response>;
    dispatched: Promise<void>;
  };

  abstract cancelAllForHost(host: string): void;
}

interface Entry {
  state: State;
  readonly request: Request;
  readonly resolve: (response: Response) => void;
  readonly reject: (error: Error) => void;
  readonly priority: Priority;
  readonly dependencies?: ReadonlySet<Entry>;
  waitUntil: DateTime;
  failures?: number;
}

/** Returns true if a is higher priority than b */
function compareDispatchEntry(a: Entry, b: Entry): boolean {
  return a.waitUntil.isBefore(b.waitUntil);
}

function dateMax(a: DateTime, b: DateTime) {
  return a.isAfter(b) ? a : b;
}

const MAX_FAILURES = [2, 2, 5, 5, 1] as const,
  ERROR_BACKOFF_SECONDS = [60 * 5, 60 * 5, 60, 5, 1] as const,
  ERROR_BACKOFF_MULTIPLIERS = [1, 10, 100, 1000, 10000] as const,
  RATELIMIT_BACKOFF_MINUTES = [60, 30, 10, 5] as const,
  SPACED_GAP_MINUTES = 5;

interface ServerQueue {
  lock: Promise<void>;
  notBefore: {
    [Priority.Soon]: DateTime;
    [Priority.Eventually]: DateTime;
    [Priority.Optional]: DateTime;
    [Priority.Spaced]: DateTime;
  };
  readonly queue: PriorityQueue<Entry>;
}

class RateLimitError extends Error {
  constructor(public readonly response: Response) {
    super("rate limited");
  }
}

@Singleton(HttpDispatcher)
export class HttpDispatcherImpl extends HttpDispatcher {
  readonly #serverQueues = new Map<string, ServerQueue>();

  constructor(
    private readonly blockedServerStore: BlockedServerStoreReadOnly,
    private readonly httpClient: HttpClientService,
    private readonly scheduler: SchedulerService,
  ) {
    super();
  }

  dispatch(
    request: Request,
    priority: Priority,
    dependencies?: Entry[],
  ): {
    cancel: () => void;
    response: Promise<Response>;
    dispatched: Promise<void>;
    entry: Entry;
  } {
    let resolve = (_: Response) => {}, reject = (_: Error) => {};
    const now = this.scheduler.now(),
      url = new URL(request.url),
      { queue, notBefore } = this.#serverQueues.get(url.host) ??
        (() => {
          const sq: ServerQueue = {
            lock: Promise.resolve(),
            queue: new PriorityQueue(compareDispatchEntry),
            notBefore: [now, now, now, now] as const,
          };
          this.#serverQueues.set(url.host, sq);
          return sq;
        })(),
      entry: Entry = {
        state: State.Initializing,
        request,
        priority,
        waitUntil: priority === Priority.Immediate
          ? now
          : dateMax(now, notBefore[priority]),
        dependencies: dependencies && new Set(dependencies),
        resolve: (r) => resolve(r),
        reject: (e) => reject(e),
      };
    if (priority === Priority.Spaced) {
      notBefore[Priority.Spaced] = entry.waitUntil.add({
        minute: SPACED_GAP_MINUTES,
      });
    }
    const responseWrapper = new Promise<() => Promise<Response>>((wResolve) => {
      const response = new Promise<Response>((pResolve, pReject) => {
        resolve = pResolve;
        reject = pReject;
        entry.state = State.Pending;
        queue.push(entry);
        this.#dispatchNext(url.host);
        wResolve(() => response);
      });
    });
    return {
      response: responseWrapper.then((f) => f()),
      dispatched: responseWrapper.then(() => {}),
      entry,
      cancel: () => this.#cancelEntry(entry),
    };
  }

  dispatchInOrder(requests: Request[], priority: Priority) {
    const first = this.dispatch(requests[0], priority),
      dispatches = [first],
      dispatch = this.dispatch.bind(this),
      dispatched = (async () => {
        await first.dispatched;
        for (const req of requests.slice(1)) {
          const next = dispatch(req, priority, dispatches.map((d) => d.entry));
          dispatches.push(next);
          await next.dispatched;
        }
      })();
    return {
      cancel: () => dispatches.forEach((d) => d.cancel()),
      dispatched,
      responses: (async function* () {
        await dispatched;
        for (const { response } of dispatches) {
          yield await response;
        }
      })(),
    };
  }

  #waitForDependencies(entry: Entry): boolean {
    let mustWait = false;
    for (const dependency of entry.dependencies ?? []) {
      switch (dependency.state) {
        case State.Initializing:
        case State.Pending:
          entry.waitUntil = dateMax(entry.waitUntil, dependency.waitUntil).add({
            millisecond: 1,
          });
          mustWait = true;
          break;
        case State.Canceled:
          this.#cancelEntry(entry, "Canceled dependency");
          return false;
        default:
          // do nothing
      }
    }
    return mustWait;
  }

  #rateLimit(response: Response, squeue: ServerQueue) {
    const now = this.scheduler.now();
    squeue.notBefore = RATELIMIT_BACKOFF_MINUTES.map((minute) =>
      now.add({ minute })
    ) as [DateTime, DateTime, DateTime, DateTime];
    const dequeued: Entry[] = [];
    while (!squeue.queue.isEmpty()) dequeued.push(squeue.queue.pop()!);
    for (const p of dequeued) {
      if (p.priority === Priority.Immediate) {
        p.state = State.Completed;
        p.resolve(response);
      } else {
        p.failures = (p.failures ?? 0) + 1;
        p.waitUntil = dateMax(p.waitUntil, squeue.notBefore[p.priority]);
        squeue.queue.push(p);
      }
    }
  }

  async #dispatchOne(entry: Entry): Promise<boolean> {
    if (this.#waitForDependencies(entry)) return true;
    if (entry.waitUntil.isAfter(this.scheduler.now())) return true;
    if ((entry.failures ?? 0) >= MAX_FAILURES[entry.priority]) {
      this.#cancelEntry(entry, "Too many failures");
      return false;
    }
    const url = new URL(entry.request.url);
    if (await this.blockedServerStore.blocksActivityUrl(url)) {
      this.#cancelEntry(entry, "Server is blocked");
      return false;
    }
    if (entry.state > State.Pending) return false;
    let response: Response;
    try {
      log.info(`Dispatching ${entry.request.method} request to ${url}`);
      response = await this.httpClient.fetch(entry.request.clone());
    } catch (e) {
      if (isHttpError(e)) {
        response = new Response(e.message, {
          status: e.status,
          statusText: e.message,
        });
      } else {
        log.error(`Error occurred while dispatching request to ${url}:`);
        log.error(e);
        entry.state = State.Canceled;
        entry.reject(e);
        return false;
      }
    }
    const now = this.scheduler.now();
    switch (response.status) {
      case Status.NotFound:
      case Status.Conflict:
      case Status.Gone:
        log.warning(
          `Got ${response.status} ${response.statusText} for ${url}, giving up`,
        );
        break;
      case Status.TooManyRequests:
      case Status.RequestTimeout:
        log.warning(
          `Got ${response.status} ${response.statusText} for ${url}, delaying all pending requests for this host`,
        );
        throw new RateLimitError(response);
      default:
        if (
          entry.priority !== Priority.Immediate &&
          isErrorStatus(response.status)
        ) {
          log.error(
            `Got ${response.status} ${response.statusText} from ${url}`,
          );
          entry.failures = (entry.failures ?? 0) + 1;
          if (entry.failures >= MAX_FAILURES[entry.priority]) {
            log.error("Canceled after too many failures");
            entry.state = State.Canceled;
            entry.resolve(response);
            return false;
          } else {
            entry.waitUntil = now.add({
              second: ERROR_BACKOFF_SECONDS[entry.priority] *
                ERROR_BACKOFF_MULTIPLIERS[entry.failures - 1],
            });
            return true;
          }
        }
    }
    entry.state = State.Completed;
    entry.resolve(response!);
    return false;
  }

  async #dispatchNext(host: string) {
    const squeue = this.#serverQueues.get(host);
    if (!squeue) return;
    const { queue, lock } = squeue;
    await lock;
    await (squeue.lock = (async () => {
      while (!(queue.peek()?.waitUntil.isAfter(this.scheduler.now()) ?? true)) {
        const next = queue.pop()!, initialFailures = next.failures;
        try {
          if (await this.#dispatchOne(next)) {
            queue.push(next);
            if (queue.peek() === next && next.failures === initialFailures) {
              // this branch should never happen
              this.#cancelEntry(next, "Priority queue isn't working (bug?)");
              queue.pop();
            }
          }
        } catch (e) {
          if (e instanceof RateLimitError) {
            queue.push(next);
            this.#rateLimit(e.response, squeue);
          } else {
            throw e;
          }
        }
      }
      const next = queue.peek();
      if (next) {
        await this.scheduler.schedule(
          `dispatch next to ${host}`,
          () => this.#dispatchNext(host),
          next.waitUntil,
          Reschedule.OnlyAsEarlier,
        );
      }
    })());
  }

  cancelAllForHost(host: string, message?: string): void {
    const queueAndLock = this.#serverQueues.get(host);
    if (!queueAndLock) return;
    const { queue, lock } = queueAndLock;
    lock.then(() => {
      for (let p = queue.pop(); p; p = queue.pop()) {
        this.#cancelEntry(p, message);
      }
    });
  }

  #cancelEntry(entry: Entry, message = "Request canceled") {
    if (entry.state <= State.Pending) {
      log.error(`Canceled dispatch to ${entry.request.url}: ${message}`);
      entry.state = State.Canceled;
      entry.reject(new Error(message));
    }
  }
}
