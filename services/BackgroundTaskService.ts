import { log } from "$/deps.ts";
import { DateTime, datetime } from "$/lib/datetime/mod.ts";
import { logError } from "$/lib/error.ts";
import { Singleton } from "$/lib/inject.ts";

export interface BackgroundTaskFailure {
  description: string;
  startedAt: DateTime;
  failedAt: DateTime;
  error: Error;
}

const MAX_FAILURES = 1024;

/**
 * Takes ownership of "detached" promises (promises that are not awaited) and
 * logs any errors they throw. These logs are kept in memory.
 */
@Singleton()
export class BackgroundTaskService {
  readonly #failures: BackgroundTaskFailure[] = [];

  watch(task: Promise<unknown>, description = "(no description)"): void {
    const startedAt = datetime();
    task.then(
      () => {
        log.debug(`Background task completed: ${description}`);
      },
      (error) => {
        if (!(error instanceof Error)) {
          error = new Error(`Threw non-Error object: ${JSON.stringify(error)}`);
        }
        while (this.#failures.length >= MAX_FAILURES) this.#failures.shift();
        this.#failures.push({
          description,
          startedAt,
          failedAt: datetime(),
          error,
        });
        logError(`Background task failed: ${description}`, error);
      },
    );
  }

  failures(): readonly BackgroundTaskFailure[] {
    return [...this.#failures];
  }
}
