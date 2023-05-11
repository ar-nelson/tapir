import { log } from "$/deps.ts";
import { datetime } from "$/lib/datetime/mod.ts";
import { InjectableAbstract, Singleton } from "$/lib/inject.ts";
import { Q } from "$/lib/sql/mod.ts";
import { chainFrom } from "$/lib/transducers.ts";
import {
  ActivityNotFound,
  LocalActivity,
  LocalActivityStore,
} from "$/models/LocalActivity.ts";
import { Activity } from "$/schemas/activitypub/mod.ts";
import {
  ActivityPubClientService,
  Priority,
  RequestOpts,
} from "$/services/ActivityPubClientService.ts";
import { LocalDatabaseService } from "$/services/LocalDatabaseService.ts";

export interface ActivityDispatch {
  id: number;
  inbox: string;
  activity: string;
  failed: boolean;
  createdAt: Date;
  receivedAt: Date | null;
}

@InjectableAbstract()
export abstract class ActivityDispatchStore {
  abstract dispatch(
    inbox: string | URL | Iterable<string | URL>,
    activity: string | LocalActivity,
    options: RequestOpts,
  ): Promise<void>;

  abstract dispatchInOrder(
    inbox: URL,
    activities:
      | Iterable<string | LocalActivity>
      | AsyncIterable<string | LocalActivity>,
    options: RequestOpts,
  ): Promise<void>;

  abstract createAndDispatch(
    inbox: string | URL | Iterable<string | URL>,
    activity: Omit<Activity, "id">,
    options: RequestOpts,
    ulid?: string,
  ): Promise<string>;

  abstract hasReceived(inbox: URL, activityUlid: string): Promise<boolean>;

  abstract inboxesWhichReceived(activityUlid: string): Promise<URL[]>;

  abstract dispatchAllPending(): Promise<void>;
}

@Singleton(ActivityDispatchStore)
export class ActivityDispatchStoreImpl extends ActivityDispatchStore {
  constructor(
    private readonly db: LocalDatabaseService,
    private readonly apClient: ActivityPubClientService,
    private readonly localActivityStore: LocalActivityStore,
  ) {
    super();
    this.dispatchAllPending();
  }

  async dispatch(
    inbox: string | URL | Iterable<string | URL>,
    activity: string | LocalActivity,
    options: RequestOpts,
  ) {
    const activityId = typeof activity === "string" ? activity : activity.id,
      activityJson = typeof activity === "string"
        ? (await this.localActivityStore.get(activity))?.json
        : activity.json;
    if (activityJson == null) {
      throw ActivityNotFound.error(
        `Cannot dispatch activity with ID ${activityId}: activity does not exist`,
      );
    }
    await chainFrom(
      (typeof inbox === "string" || inbox instanceof URL) ? [inbox] : inbox,
    )
      .mapAsync((inboxUrl) => {
        const inbox = inboxUrl instanceof URL ? inboxUrl.href : inboxUrl;
        return this.db.transaction(async (db) => {
          for await (
            const { id, createdAt, receivedAt, failed } of db.get(
              "activityDispatch",
              {
                where: { activity: activityId, inbox },
                limit: 1,
                returning: ["id", "createdAt", "receivedAt", "failed"],
              },
            )
          ) {
            if (
              receivedAt ||
              (!failed &&
                datetime(createdAt).isAfter(datetime().subtract({ day: 1 })))
            ) {
              // Either the dispatch has already been received, or it is still in flight.
              return undefined;
            }
            await db.delete("activityDispatch", { id });
          }
          const [{ id }] = await db.insert("activityDispatch", [{
            inbox,
            activity: activityId,
            createdAt: new Date(),
            key: options.key,
          }], ["id"]);
          return {
            id,
            inbox: inboxUrl instanceof URL ? inboxUrl : new URL(inbox),
          };
        });
      })
      .notNull()
      .foreachAsync(({ id, inbox }) =>
        this.apClient.publishActivity(
          inbox,
          activityJson,
          { priority: Priority.Soon, ...options },
          async () => {
            await this.db.update("activityDispatch", { id }, {
              failed: false,
              receivedAt: new Date(),
            });
          },
          async () => {
            await this.db.update("activityDispatch", { id }, {
              failed: true,
            });
          },
        )
      );
  }

  async dispatchInOrder(
    inbox: URL,
    activities:
      | Iterable<string | LocalActivity>
      | AsyncIterable<string | LocalActivity>,
    options: RequestOpts,
  ) {
    let finalActivities = await chainFrom(
      activities as AsyncIterable<string | LocalActivity>,
    )
      .mapAsync(async (activity) => {
        if (typeof activity === "string") {
          const a = await this.localActivityStore.get(activity);
          if (a) return a;
          else {
            throw ActivityNotFound.error(
              `Cannot dispatch activity with ID ${activity}: activity does not exist`,
            );
          }
        } else {
          return activity;
        }
      }).toArray();
    const dispatches = await this.db.transaction(async (db) => {
      for await (
        const { id, activity, failed, createdAt, receivedAt } of db.get(
          "activityDispatch",
          {
            where: {
              inbox: inbox.toString(),
              activity: Q.in(finalActivities.map((a) => a.id)),
            },
            returning: ["id", "activity", "failed", "createdAt", "receivedAt"],
          },
        )
      ) {
        if (
          receivedAt ||
          (!failed &&
            datetime(createdAt).isAfter(datetime().subtract({ day: 1 })))
        ) {
          finalActivities = finalActivities.filter((a) => a.id !== activity);
        } else {
          await db.delete("activityDispatch", { id });
        }
      }
      const now = new Date();
      return db.insert(
        "activityDispatch",
        finalActivities.map((a) => ({
          activity: a.id,
          inbox: inbox.toString(),
          createdAt: now,
          key: options.key,
        })),
        ["id", "activity"],
      );
    });
    if (!finalActivities.length) return;
    await this.apClient.publishActivitiesInOrder(
      inbox,
      finalActivities.map((a) => a.json),
      { priority: Priority.Spaced, ...options },
      async (_rsp, activity) => {
        const id = dispatches.find((d) => d.activity === activity.id)?.id;
        if (id) {
          await this.db.update("activityDispatch", { id }, {
            failed: false,
            receivedAt: new Date(),
          });
        } else {
          log.error(
            `No dispatched activity with id ${activity.id}. This should never happen!`,
          );
        }
      },
      async (_err, activity) => {
        const id = dispatches.find((d) => d.activity === activity.id)?.id;
        if (id) {
          await this.db.update("activityDispatch", { id }, {
            failed: true,
          });
        } else {
          log.error(
            `No dispatched activity with id ${activity.id}. This should never happen!`,
          );
        }
      },
    );
  }

  async createAndDispatch(
    inbox: string | URL | Iterable<string | URL>,
    activity: Omit<Activity, "id">,
    options: RequestOpts,
    ulid?: string,
  ) {
    const newActivity = await this.localActivityStore.create(activity, ulid);
    this.dispatch(inbox, newActivity, options);
    return newActivity.id;
  }

  inboxesWhichReceived(activityUlid: string) {
    return chainFrom(this.db.get("activityDispatch", {
      where: { activity: activityUlid, receivedAt: Q.notNull() },
    }))
      .map((a) => new URL(a.inbox))
      .toArray();
  }

  async hasReceived(inbox: URL, activityUlid: string) {
    for await (
      const { receivedAt } of this.db.get("activityDispatch", {
        where: { activity: activityUlid, inbox: inbox.toString() },
        limit: 1,
        returning: ["receivedAt"],
      })
    ) {
      return !!receivedAt;
    }
    return false;
  }

  async dispatchAllPending() {
    const toDispatch: { inbox: string; activity: string; key: string }[] = [];
    await this.db.transaction(async (txn) => {
      for await (
        const { id, inbox, activity, key } of txn.get("activityDispatch", {
          where: { failed: false, receivedAt: Q.null() },
          returning: ["id", "inbox", "activity", "key"],
        })
      ) {
        await txn.delete("activityDispatch", { id });
        if (key == null) {
          log.error(
            "Cannot dispatch pending activity: no signing key (database migration error?)",
          );
        } else {
          toDispatch.push({ inbox, activity, key });
        }
      }
    });
    await Promise.all(
      toDispatch.map(({ inbox, activity, key }) =>
        this.dispatch(new URL(inbox), activity, {
          key,
          priority: Priority.Spaced,
        })
      ),
    );
  }
}
