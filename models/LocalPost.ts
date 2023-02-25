import { InjectableAbstract, Singleton } from "$/lib/inject.ts";
import { LocalDatabaseService } from "$/services/LocalDatabaseService.ts";
import { OrderDirection, Q } from "$/lib/sql/mod.ts";
import { PostType } from "$/schemas/tapir/LocalDatabase.ts";
export { PostType } from "$/schemas/tapir/LocalDatabase.ts";
import { LocalActivityStore } from "$/models/LocalActivity.ts";
import { ServerConfigStore } from "$/models/ServerConfig.ts";
import { Activity, key, Object } from "$/schemas/activitypub/mod.ts";
import * as urls from "$/lib/urls.ts";

export interface LocalPost {
  readonly id: string;
  readonly type: PostType;
  readonly persona: string;
  readonly createdAt: string;
  readonly updatedAt?: string;
  readonly content?: string;
  readonly collapseSummary?: string;
  readonly replyTo?: string;
}

export interface PostUpdate {
  readonly content: string;
  readonly collapseSummary?: string;
}

@InjectableAbstract()
export abstract class LocalPostStore {
  abstract list(options?: {
    readonly persona?: string;
    readonly limit?: number;
    readonly beforeId?: string;
    readonly order?: OrderDirection;
  }): AsyncIterable<LocalPost>;

  abstract count(persona?: string): Promise<number>;

  abstract get(id: string): Promise<LocalPost | null>;

  abstract create(
    post: Omit<LocalPost, "id" | "createdAt" | "updatedAt">,
  ): Promise<string>;

  abstract update(id: string, update: PostUpdate): Promise<void>;

  abstract delete(id: string): Promise<void>;
}

@Singleton(LocalPostStore)
export class LocalPostStoreImpl extends LocalPostStore {
  private readonly serverConfig;

  constructor(
    private readonly db: LocalDatabaseService,
    private readonly localActivityStore: LocalActivityStore,
    serverConfigStore: ServerConfigStore,
  ) {
    super();
    this.serverConfig = serverConfigStore.getServerConfig();
  }

  private async publicActivity(
    persona: string,
    props: {
      type: Activity["type"];
      createdAt?: Date;
      object?: Object | string;
      target?: Object | string;
    },
  ): Promise<Omit<Activity, "id">> {
    return {
      type: props.type,
      actor: urls.activityPubActor(
        persona,
        (await this.serverConfig).url,
      ),
      to: key.Public,
      cc: urls.activityPubFollowers(
        persona,
        (await this.serverConfig).url,
      ),
      published: (props.createdAt ?? new Date()).toJSON(),
      ...props.object ? { object: props.object } : {},
      ...props.target ? { target: props.target } : {},
    };
  }

  private async publicNote(
    persona: string,
    props: Partial<Object>,
  ): Promise<Object> {
    return {
      type: props.type ?? "Note",
      attributedTo: urls.profile(
        persona,
        (await this.serverConfig).url,
      ),
      to: key.Public,
      cc: urls.activityPubFollowers(
        persona,
        (await this.serverConfig).url,
      ),
      attachment: [],
      ...props,
    };
  }

  async *list({ persona, limit, beforeId, order = "DESC" }: {
    persona?: string;
    limit?: number;
    beforeId?: string;
    order?: OrderDirection;
  } = {}): AsyncIterable<LocalPost> {
    for await (
      const p of this.db.get("post", {
        where: {
          ...(persona != null ? { persona } : {}),
          ...(beforeId != null ? { id: Q.lt(beforeId) } : {}),
        },
        orderBy: [["id", order]],
        limit,
      })
    ) {
      yield {
        ...p,
        content: p.content ?? undefined,
        collapseSummary: p.collapseSummary ?? undefined,
        createdAt: p.createdAt.toJSON(),
        updatedAt: p.updatedAt?.toJSON(),
      };
    }
  }

  count(persona?: string): Promise<number> {
    return Promise.resolve(
      this.db.count("post", persona ? { persona } : {}),
    );
  }

  async get(id: string): Promise<LocalPost | null> {
    for await (const p of this.db.get("post", { where: { id } })) {
      return {
        ...p,
        content: p.content ?? undefined,
        collapseSummary: p.collapseSummary ?? undefined,
        createdAt: p.createdAt.toJSON(),
        updatedAt: p.updatedAt?.toJSON(),
      };
    }
    return null;
  }

  async create(
    post: Omit<LocalPost, "id" | "createdAt" | "updatedAt">,
  ): Promise<string> {
    const createdAt = new Date(),
      id = await this.localActivityStore.create(
        await this.publicActivity(post.persona, {
          type: "Create",
          createdAt,
          object: await this.publicNote(post.persona, {
            content: post.content,
            published: createdAt.toJSON(),
            updated: createdAt.toJSON(),
            summary: post.collapseSummary,
          }),
        }),
        post.persona,
      );
    await this.db.insert("post", [{
      ...post,
      id,
      content: post.content,
      createdAt,
      collapseSummary: post.collapseSummary,
    }]);
    return id;
  }

  async update(id: string, update: PostUpdate): Promise<void> {
    const existing = await this.get(id),
      originalJson = await this.localActivityStore.getObject(id);
    if (existing == null || originalJson == null) {
      throw new Error(`Cannot update post ${id}: post does not exist`);
    }
    if (existing.content == null) {
      throw new Error(
        `Cannot update post ${id}: post does not have text content`,
      );
    }
    const updatedAt = new Date(),
      newJson = {
        ...originalJson,
        updated: updatedAt.toJSON(),
        content: update.content ?? originalJson.content,
        summary: update.collapseSummary ?? originalJson.summary,
      };
    await this.localActivityStore.create(
      await this.publicActivity(existing.persona, {
        type: "Update",
        createdAt: updatedAt,
        target: urls.activityPubObject(id, (await this.serverConfig).url),
        object: newJson,
      }),
      existing.persona,
    );
    await this.localActivityStore.updateObject(id, newJson);
    await this.db.update("post", { id }, {
      content: update.content,
      collapseSummary: update.collapseSummary,
      updatedAt,
    });
  }

  async delete(id: string): Promise<void> {
    const existing = await this.get(id);
    if (existing == null) {
      return;
    }
    await this.localActivityStore.create(
      await this.publicActivity(existing.persona, {
        type: "Delete",
        target: urls.activityPubObject(id, (await this.serverConfig).url),
      }),
      existing.persona,
    );
    await this.db.delete("post", { id });
  }
}
