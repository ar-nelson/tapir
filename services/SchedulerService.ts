import { InjectableAbstract, Singleton } from "$/lib/inject.ts";
import { DateTime, datetime, diffInMillisec } from "$/lib/datetime/mod.ts";

export interface Interval {
  millisecond?: number;
  second?: number;
  minute?: number;
  hour?: number;
  day?: number;
}

export enum Reschedule {
  Always,
  OnlyAsEarlier,
  OnlyAsLater,
  Repeat,
}

export interface ScheduleEntry {
  key: string;
  last?: DateTime;
  next?: DateTime;
  lastError?: string | Error;
  repeat?: Interval;
}

@InjectableAbstract()
export abstract class SchedulerService {
  protected readonly entries = new Map<
    string,
    ScheduleEntry & { fn: () => void | Promise<void> }
  >();

  abstract now(): DateTime;

  protected abstract notifyLater(key: string, delayMs: number): void;

  protected async notifyNow(key: string): Promise<void> {
    const entry = this.entries.get(key), now = this.now();
    if (entry?.next && !now.isBefore(entry.next)) {
      entry.last = now;
      if (entry.repeat) {
        entry.next = entry.next.add(entry.repeat);
        this.notifyLater(key, diffInMillisec(now, entry.next));
      } else {
        delete entry.next;
      }
      delete entry.lastError;
      try {
        const possiblePromise = entry.fn();
        if (possiblePromise instanceof Promise) {
          await possiblePromise;
        }
      } catch (e) {
        entry.lastError = e;
      }
    }
  }

  async schedule(
    key: string,
    fn: () => void | Promise<void>,
    time: DateTime | Interval,
    reschedule = Reschedule.Always,
  ): Promise<void> {
    const existing = this.entries.get(key),
      now = this.now(),
      newTime = "locale" in time ? time : now.add(time);
    let finalTime = existing?.next ?? newTime, repeat = existing?.repeat;
    if (existing) {
      switch (reschedule) {
        case Reschedule.Always:
          finalTime = newTime;
          break;
        case Reschedule.OnlyAsEarlier:
          if (newTime.isBefore(finalTime)) {
            finalTime = newTime;
          }
          break;
        case Reschedule.OnlyAsLater:
          if (newTime.isAfter(finalTime)) {
            finalTime = newTime;
          }
          break;
        case Reschedule.Repeat:
          if (time instanceof Date) {
            throw new TypeError(
              "Reschedule.Repeat cannot be used with a literal Date",
            );
          }
          finalTime = newTime;
          repeat = time;
          break;
      }
    }
    this.entries.set(key, {
      ...existing ?? {},
      key,
      fn,
      next: finalTime,
      repeat,
    });
    const diff = diffInMillisec(finalTime, now);
    if (diff > 0) this.notifyLater(key, diff);
    else await this.notifyNow(key);
  }

  cancel(key: string) {
    const entry = this.entries.get(key);
    if (entry?.next) {
      delete entry.next;
      delete entry.repeat;
      entry.last = this.now();
      entry.lastError = "canceled";
    }
  }

  cancelAllWithPrefix(prefix: string) {
    for (const key of this.entries.keys()) {
      if (key.startsWith(prefix)) {
        this.cancel(key);
      }
    }
  }

  list() {
    return [...this.entries.values()].map((x) => ({ ...x }));
  }
}

@Singleton(SchedulerService)
export class SchedulerServiceImpl extends SchedulerService {
  protected notifyLater(key: string, delayMs: number): void {
    setTimeout(() => this.notifyNow(key), delayMs);
  }

  now() {
    return datetime();
  }
}
