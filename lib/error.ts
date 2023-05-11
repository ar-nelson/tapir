import { log, Status } from "$/deps.ts";
import {
  AsyncTransducer,
  stepTransducer,
  stepTransducerAsync,
  Transducer,
} from "$/lib/transducers.ts";

export const LogLevels = log.LogLevels;

export class Tag {
  public readonly level: number;
  public readonly needsStackTrace: boolean;
  public readonly httpStatus: number;
  public readonly internal: boolean;

  constructor(
    public readonly name: string,
    {
      level = LogLevels.ERROR,
      needsStackTrace = true,
      httpStatus = Status.InternalServerError,
      internal = true,
    }: {
      level?: number;
      needsStackTrace?: boolean;
      httpStatus?: number;
      internal?: boolean;
    } = {},
  ) {
    this.level = level;
    this.needsStackTrace = needsStackTrace;
    this.httpStatus = httpStatus;
    this.internal = internal;
  }

  wrap(cause: Error): TagError {
    if (Tag.is(cause, this)) return cause;
    return new TagError(this, cause);
  }

  error(message: string, cause?: Error): TagError {
    return new TagError(this, message, cause);
  }

  static is(e: unknown, ...tags: Tag[]): e is TagError {
    if (!(e instanceof TagError)) return false;
    if (!tags.length) return true;
    return tags.includes(e.tag);
  }
}

export class TagError extends Error {
  readonly cause?: Error;

  constructor(tag: Tag, cause: Error);
  constructor(tag: Tag, message: string, cause?: Error);
  constructor(
    public readonly tag: Tag,
    messageOrError: string | Error,
    cause?: Error,
  ) {
    super(
      typeof messageOrError === "string"
        ? messageOrError
        : messageOrError.message,
      typeof messageOrError === "string" ? cause : messageOrError,
    );
    this.cause = typeof messageOrError === "string" ? cause : messageOrError;
  }

  get level(): number {
    const parentLevel = this.cause
      ? (this.cause instanceof TagError ? this.cause.level : LogLevels.ERROR)
      : LogLevels.NOTSET;
    return Math.max(this.tag.level, parentLevel);
  }

  toString(): string {
    return `[${this.tag.name}] ${this.message}${
      this.tag.needsStackTrace ? `\n${this.stack}` : ""
    }${
      this.cause
        ? (this.cause instanceof TagError
          ? `\ncaused by ${this.cause.toString()}`
          : `\ncaused by [${this.cause.constructor.name}]: ${this.cause.message}\n${this.cause.stack}`)
        : ""
    }`;
  }
}

export function logError(message: string, error: unknown): void {
  if (error instanceof TagError) {
    const logMessage = () => `${message}:\n${error.toString()}`;
    switch (error.level) {
      case LogLevels.CRITICAL:
        log.critical(logMessage);
        break;
      case LogLevels.WARNING:
        log.warning(logMessage);
        break;
      case LogLevels.INFO:
        log.info(logMessage);
        break;
      case LogLevels.DEBUG:
        log.debug(logMessage);
        break;
      default:
        log.error(logMessage);
    }
  } else if (error instanceof Error) {
    log.error(() => `${message}:\n${error.message}\n${error.stack}`);
  } else {
    log.error(() =>
      `${message}:\n(non-Error object: ${JSON.stringify(error)})`
    );
  }
}

export function mapOrCatch<I, O>(
  f: (i: I) => O,
  tag: Tag | Tag[],
  message?: string,
): Transducer<I, O> {
  const isTag: (t: Tag) => boolean = Array.isArray(tag)
    ? ((t) => tag.includes(t))
    : (t) => t === tag;
  return stepTransducer(function (result, input) {
    let next;
    try {
      next = f(input);
    } catch (e) {
      if (e instanceof TagError && isTag(e.tag)) {
        if (message) logError(message, e);
        return result;
      }
      throw e;
    }
    return this.step(result, next);
  });
}

export function mapOrCatchAsync<I, O>(
  f: (i: I) => Promise<O>,
  tag: Tag | Tag[],
  message?: string,
): AsyncTransducer<I, O> {
  const isTag: (t: Tag) => boolean = Array.isArray(tag)
    ? ((t) => tag.includes(t))
    : (t) => t === tag;
  return stepTransducerAsync(async function (result, input) {
    let next;
    try {
      next = await f(input);
    } catch (e) {
      if (e instanceof TagError && isTag(e.tag)) {
        if (message) logError(message, e);
        return result;
      }
      throw e;
    }
    return this.step(result, next);
  });
}
