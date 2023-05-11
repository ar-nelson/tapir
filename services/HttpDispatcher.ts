import { isErrorStatus, isHttpError, log, Status } from "$/deps.ts";
import { DateTime } from "$/lib/datetime/mod.ts";
import { logError, LogLevels, Tag } from "$/lib/error.ts";
import { InjectableAbstract, Singleton } from "$/lib/inject.ts";
import { PriorityQueue } from "$/lib/priorityQueue.ts";
import { isSubdomainOf } from "$/lib/urls.ts";
import {
  DomainTrustStore,
  OutgoingRequestBlocked,
} from "$/models/DomainTrust.ts";
import { TrustLevel } from "$/models/types.ts";
import { BackgroundTaskService } from "$/services/BackgroundTaskService.ts";
import { HttpClientService } from "$/services/HttpClientService.ts";
import { Reschedule, SchedulerService } from "$/services/SchedulerService.ts";

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

export const DEFAULT_MAX_BYTES = 16 * 1024 * 1024;

export interface DispatchOptions {
  readonly priority: Priority;
  readonly overrideTrust?: boolean;
  readonly maxBytes?: number;
  readonly throwOnError?: Tag;
  readonly errorMessage?: string;
  readonly abort?: AbortController;
}

@InjectableAbstract()
export abstract class HttpDispatcher {
  constructor(
    protected readonly backgroundTaskService: BackgroundTaskService,
  ) {}

  abstract dispatchAndWait(
    request: Request,
    options: DispatchOptions,
  ): Promise<Response>;

  dispatch(
    request: Request,
    options: DispatchOptions,
    onComplete?: (response: Response) => void | Promise<void>,
    onError?: (error: Error) => void | Promise<void>,
  ): void {
    const response = this.dispatchAndWait(request, options);
    this.backgroundTaskService.watch(
      onComplete || onError
        ? response.then(
          onComplete,
          onError && (async (e) => {
            await onError(e);
            throw e;
          }),
        )
        : response,
      `Dispatch to ${request.url}`,
    );
  }

  dispatchInOrder(
    requests: readonly Request[],
    options: DispatchOptions,
    onComplete: (response: Response, request: Request) => void | Promise<void> =
      () => {},
    onError?: (error: Error, request: Request) => void | Promise<void>,
  ): void {
    if (requests.length === 0) return;
    else if (requests.length === 1) {
      return this.dispatch(
        requests[0],
        options,
        onComplete && ((rsp) => onComplete(rsp, first)),
        onError && ((e) => onError(e, first)),
      );
    }
    const [first, ...rest] = requests,
      r0 = this.dispatchAndWait(first, options);
    let req: Request | undefined = first;
    this.backgroundTaskService.watch(
      (async () => {
        try {
          await onComplete(await r0, first);
          while ((req = rest.shift())) {
            await onComplete(await this.dispatchAndWait(req, options), req);
          }
        } catch (e) {
          if (onError) {
            for (const r of [req!, ...rest]) await onError(e, r);
          }
          throw e;
        }
      })(),
      `Dispatch ${requests.length} sequential requests, starting with ${first.url}`,
    );
  }

  async dispatchInOrderAndWait(
    requests: readonly Request[],
    options: DispatchOptions,
  ): Promise<readonly Response[]> {
    const responses: Response[] = [];
    for (const req of requests) {
      responses.push(await this.dispatchAndWait(req, options));
    }
    return responses;
  }

  abstract cancelAllForDomain(domain: string, reason?: Error): void;
}

interface Entry {
  state: State;
  readonly request: Request;
  readonly overrideTrust: boolean;
  readonly maxBytes: number;
  readonly resolve: (response: Response) => void;
  readonly reject: (error: Error) => void;
  readonly priority: Priority;
  readonly abort: AbortController;
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

export const DispatchFailed = new Tag("HTTP Dispatch Failed", {
  level: LogLevels.WARNING,
  needsStackTrace: false,
});

export async function responseOrThrow(
  response: Promise<Response>,
  url: string,
  tag = DispatchFailed,
  message?: string,
): Promise<Response> {
  try {
    const rsp = await response;
    if (isErrorStatus(rsp.status)) {
      throw DispatchFailed.error(
        `HTTP error ${rsp.status} ${rsp.statusText} from ${url}`,
      );
    }
    return rsp;
  } catch (e) {
    throw message ? tag.error(message, e) : tag.wrap(e);
  }
}

@Singleton(HttpDispatcher)
export class HttpDispatcherImpl extends HttpDispatcher {
  readonly #serverQueues = new Map<string, ServerQueue>();

  constructor(
    private readonly domainTrustStore: DomainTrustStore,
    private readonly httpClient: HttpClientService,
    private readonly scheduler: SchedulerService,
    backgroundTaskService: BackgroundTaskService,
  ) {
    super(backgroundTaskService);
  }

  dispatchAndWait(
    request: Request,
    {
      priority,
      overrideTrust = false,
      maxBytes = DEFAULT_MAX_BYTES,
      throwOnError,
      errorMessage,
      abort = new AbortController(),
    }: DispatchOptions,
  ): Promise<Response> {
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
        overrideTrust,
        maxBytes,
        waitUntil: priority === Priority.Immediate
          ? now
          : dateMax(now, notBefore[priority]),
        abort,
        resolve: (r) => resolve(r),
        reject: (e) => reject(e),
      };
    if (priority === Priority.Spaced) {
      notBefore[Priority.Spaced] = entry.waitUntil.add({
        minute: SPACED_GAP_MINUTES,
      });
    }
    abort.signal.addEventListener("abort", () => {
      if (entry.state <= State.Pending) {
        logError(
          `Canceled dispatch to ${entry.request.url}`,
          abort.signal.reason,
        );
        entry.state = State.Canceled;
        entry.reject(abort.signal.reason);
      }
    });
    const response = new Promise<Response>((pResolve, pReject) => {
      resolve = pResolve;
      reject = pReject;
      entry.state = State.Pending;
      queue.push(entry);
      this.#dispatchNext(url.host);
    });
    return throwOnError
      ? responseOrThrow(response, request.url, throwOnError, errorMessage)
      : response;
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
    if (entry.waitUntil.isAfter(this.scheduler.now())) return true;
    if ((entry.failures ?? 0) >= MAX_FAILURES[entry.priority]) {
      entry.abort.abort(
        DispatchFailed.error(
          `Too many failures: stopped trying request to ${entry.request.url} after ${entry.failures} failures`,
        ),
      );
      return false;
    }
    const url = new URL(entry.request.url);
    if (
      await this.domainTrustStore.requestToTrust(url) <=
        (entry.overrideTrust
          ? TrustLevel.BlockUnconditional
          : TrustLevel.BlockUnlessFollow)
    ) {
      entry.abort.abort(
        OutgoingRequestBlocked.error(
          `Cannot make HTTP request to ${url}: server is blocked`,
        ),
      );
      return false;
    }
    if (entry.state > State.Pending) return false;
    let response: Response;
    try {
      log.info(`Dispatching ${entry.request.method} request to ${url}`);
      response = await this.httpClient.fetch(entry.request.clone(), {
        signal: entry.abort.signal,
      });
    } catch (e) {
      if (isHttpError(e)) {
        response = new Response(e.message, {
          status: e.status,
          statusText: e.message,
        });
      } else {
        logError(`Error occurred while dispatching request to ${url}`, e);
        entry.state = State.Canceled;
        entry.reject(e);
        return false;
      }
    }
    const now = this.scheduler.now();
    switch (response.status) {
      case Status.BadRequest:
      case Status.Unauthorized:
      case Status.PaymentRequired:
      case Status.Forbidden:
      case Status.NotFound:
      case Status.MethodNotAllowed:
      case Status.Conflict:
      case Status.Gone:
      case Status.RequestEntityTooLarge:
      case Status.RequestURITooLong:
      case Status.RequestHeaderFieldsTooLarge:
      case Status.UnavailableForLegalReasons:
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
              next.abort.abort(
                new Error("Priority queue isn't working (bug?)"),
              );
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

  cancelAllForDomain(domain: string, reason?: Error): void {
    for (const [key, { queue, lock }] of this.#serverQueues) {
      if (!isSubdomainOf(domain, key)) continue;
      lock.then(() => {
        for (let p = queue.pop(); p; p = queue.pop()) {
          p.abort.abort(reason);
        }
      });
    }
  }
}
