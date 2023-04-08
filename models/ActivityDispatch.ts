import { isErrorStatus } from "$/deps.ts";
import { datetime } from "$/lib/datetime/mod.ts";
import { InjectableAbstract, Singleton } from "$/lib/inject.ts";
import { Q } from "$/lib/sql/mod.ts";
import { asyncToArray } from "$/lib/utils.ts";
import { LocalActivity, LocalActivityStore } from "$/models/LocalActivity.ts";
import { Activity } from "$/schemas/activitypub/mod.ts";
import {
  ActivityPubClientService,
  Priority,
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
    inbox: URL | URL[],
    activity: string | LocalActivity,
    priority?: Priority,
  ): Promise<void>;

  abstract dispatchInOrder(
    inbox: URL,
    activities:
      | Iterable<string | LocalActivity>
      | AsyncIterable<string | LocalActivity>,
    priority?: Priority,
  ): Promise<void>;

  abstract createAndDispatch(
    inbox: URL | URL[],
    activity: Omit<Activity, "id">,
    ulid?: string,
    priority?: Priority,
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
    inbox: URL | URL[],
    activity: string | LocalActivity,
    priority = Priority.Soon,
  ) {
    const activityId = typeof activity === "string" ? activity : activity.id,
      activityJson = typeof activity === "string"
        ? (await this.localActivityStore.get(activity))?.json
        : activity.json;
    if (activityJson == null) {
      throw new Error(
        `Cannot dispatch activity with ID ${activityId}: activity does not exist`,
      );
    }
    await Promise.all(
      (Array.isArray(inbox) ? inbox : [inbox]).map(async (inbox) => {
        const id = await this.db.transaction(async (db) => {
          for await (
            const { id, createdAt, receivedAt, failed } of db.get(
              "activityDispatch",
              {
                where: { activity: activityId, inbox: inbox.toString() },
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
            inbox: inbox.toString(),
            activity: activityId,
            createdAt: new Date(),
          }], ["id"]);
          return id;
        });
        if (id != null) {
          const rsp = await this.apClient.publishActivity(
            inbox,
            activityJson,
            priority,
          );
          if (isErrorStatus(rsp.status)) {
            await this.db.update("activityDispatch", { id }, { failed: true });
          } else {
            await this.db.update("activityDispatch", { id }, {
              failed: false,
              receivedAt: new Date(),
            });
          }
        }
      }),
    );
  }

  async dispatchInOrder(
    inbox: URL,
    activities:
      | Iterable<string | LocalActivity>
      | AsyncIterable<string | LocalActivity>,
    priority = Priority.Spaced,
  ) {
    type AnyIter = {
      [Symbol.iterator]?: () => Iterator<string | LocalActivity>;
      [Symbol.asyncIterator]?: () => AsyncIterator<string | LocalActivity>;
    };
    const iter = ((activities as AnyIter)[Symbol.iterator]?.() ??
      (activities as AnyIter)[Symbol.asyncIterator]?.())!;
    let next: IteratorResult<string | LocalActivity>,
      finalActivities: LocalActivity[] = [];
    while (!(next = await iter.next()).done) {
      if (typeof next.value === "string") {
        const a = await this.localActivityStore.get(next.value);
        if (a) finalActivities.push(a);
        else {throw new Error(
            `Cannot dispatch activity with ID ${next.value}: activity does not exist`,
          );}
      } else {
        finalActivities.push(next.value);
      }
    }
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
        })),
        ["id"],
      );
    });
    if (!finalActivities.length) return;
    let i = 0;
    for await (
      const rsp of await this.apClient.publishActivitiesInOrder(
        inbox,
        finalActivities.map((a) => a.json),
        finalActivities[0].persona,
        priority,
      )
    ) {
      const dispatch = dispatches[i++];
      if (isErrorStatus(rsp.status)) {
        await this.db.update("activityDispatch", { id: dispatch.id }, {
          failed: true,
        });
      } else {
        await this.db.update("activityDispatch", { id: dispatch.id }, {
          failed: false,
          receivedAt: new Date(),
        });
      }
    }
  }

  async createAndDispatch(
    inbox: URL | URL[],
    activity: Omit<Activity, "id">,
    ulid?: string,
    priority?: Priority,
  ) {
    const newActivity = await this.localActivityStore.create(activity, ulid);
    await this.dispatch(inbox, newActivity, priority);
    return newActivity.id;
  }

  async inboxesWhichReceived(activityUlid: string) {
    return (await asyncToArray(
      this.db.get("activityDispatch", {
        where: { activity: activityUlid, receivedAt: Q.notNull() },
      }),
    )).map((a) => new URL(a.inbox));
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
    const toDispatch: { inbox: string; activity: string }[] = [];
    await this.db.transaction(async (db) => {
      for await (
        const { id, inbox, activity } of db.get("activityDispatch", {
          where: { failed: false, receivedAt: Q.null() },
          returning: ["id", "inbox", "activity"],
        })
      ) {
        await db.delete("activityDispatch", { id });
        toDispatch.push({ inbox, activity });
      }
    });
    for (const { inbox, activity } of toDispatch) {
      this.dispatch(new URL(inbox), activity, Priority.Spaced);
    }
  }
}
