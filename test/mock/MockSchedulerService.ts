import { SchedulerService } from "$/services/SchedulerService.ts";
import { PriorityQueue } from "$/lib/priorityQueue.ts";
import { DateDiff, DateTime, datetime } from "$/lib/datetime/mod.ts";

interface Timer {
  time: DateTime;
  fn: () => void;
}

export class MockSchedulerService extends SchedulerService {
  #clock = datetime();
  readonly #timers = new PriorityQueue<Timer>((a, b) =>
    a.time.isBefore(b.time)
  );

  now() {
    return this.#clock;
  }

  async fastforward(interval: DateDiff) {
    await new Promise((resolve) => setTimeout(resolve, 5));
    const finalTime = this.#clock.add(interval);
    while (!(this.#timers.peek()?.time?.isAfter(finalTime) ?? true)) {
      const { fn, time } = this.#timers.pop()!;
      if (time.isAfter(this.#clock)) this.#clock = time;
      fn();
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    this.#clock = finalTime;
  }

  protected notifyLater(key: string, delayMs: number): void {
    const time = this.#clock.add({ millisecond: delayMs });
    this.#timers.push({
      fn: () => this.notifyNow(key),
      time,
    });
  }
}
