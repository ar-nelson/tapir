import { InjectableAbstract, Singleton } from "$/lib/inject.ts";
import { OrderDirection, Q } from "$/lib/sql/mod.ts";
import * as urls from "$/lib/urls.ts";
import { ActivityDispatchStore } from "$/models/ActivityDispatch.ts";
import { InFollowStore } from "$/models/InFollow.ts";
import { LocalActivityStore } from "$/models/LocalActivity.ts";
import { LocalAttachment } from "$/models/LocalAttachment.ts";
import { LocalMediaStore } from "$/models/LocalMedia.ts";
import { TapirConfig } from "$/models/TapirConfig.ts";
import { ActivityPubGeneratorService } from "$/services/ActivityPubGeneratorService.ts";
import { LocalDatabaseService } from "$/services/LocalDatabaseService.ts";
import { UlidService } from "$/services/UlidService.ts";

export enum PostType {
  Note = 0,
  Reply = 1,
  Boost = 2,
  Poll = 3,
  Article = 4,
  Link = 5,
}

export interface LocalPost {
  readonly id: string;
  readonly type: PostType;
  readonly persona: string;
  readonly createdAt: Date;
  readonly updatedAt?: Date;
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
    createAttachments?: (id: string) => Promise<readonly LocalAttachment[]>,
  ): Promise<string>;

  abstract update(id: string, update: PostUpdate): Promise<void>;

  abstract delete(id: string): Promise<void>;
}

@Singleton(LocalPostStore)
export class LocalPostStoreImpl extends LocalPostStore {
  constructor(
    private readonly db: LocalDatabaseService,
    private readonly apGen: ActivityPubGeneratorService,
    private readonly activityDispatchStore: ActivityDispatchStore,
    private readonly localMediaStore: LocalMediaStore,
    private readonly localActivityStore: LocalActivityStore,
    private readonly inFollowStore: InFollowStore,
    private readonly ulid: UlidService,
    private readonly config: TapirConfig,
  ) {
    super();
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
        createdAt: p.createdAt,
        updatedAt: p.updatedAt ?? undefined,
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
        createdAt: p.createdAt,
        updatedAt: p.updatedAt ?? undefined,
      };
    }
    return null;
  }

  async create(
    post: Omit<LocalPost, "id" | "createdAt" | "updatedAt">,
    createAttachments?: (id: string) => Promise<readonly LocalAttachment[]>,
  ): Promise<string> {
    const id = this.ulid.next(), createdAt = new Date();
    await this.db.insert("post", [{
      ...post,
      id,
      content: post.content,
      createdAt,
      collapseSummary: post.collapseSummary,
    }]);
    const attachments = createAttachments ? await createAttachments(id) : [],
      media = await Promise.all(attachments.map(async (attachment) => {
        const media = await this.localMediaStore.getMeta(attachment.original);
        if (media == null) {
          throw new Error(
            `No media exists for attachment with hash ${attachment.original}`,
          );
        }
        return media;
      }));
    await this.activityDispatchStore.createAndDispatch(
      await this.inFollowStore.listFollowerInboxes(post.persona),
      this.apGen.publicActivity(post.persona, {
        type: "Create",
        createdAt,
        object: this.apGen.publicObject(post.persona, {
          type: "Note",
          content: post.content,
          published: createdAt.toJSON(),
          updated: createdAt.toJSON(),
          summary: post.collapseSummary,
          attachment: await Promise.all(
            attachments.map((a, i) =>
              this.apGen.attachment({ ...media[i], ...a })
            ),
          ),
        }),
      }),
      id,
    );
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
    await this.db.update("post", { id }, {
      content: update.content,
      collapseSummary: update.collapseSummary,
      updatedAt,
    });
    await this.activityDispatchStore.createAndDispatch(
      await this.activityDispatchStore.inboxesWhichReceived(id),
      this.apGen.publicActivity(existing.persona, {
        type: "Update",
        createdAt: updatedAt,
        target: urls.activityPubObject(id, this.config.url),
        object: newJson,
      }),
    );
    await this.localActivityStore.updateObject(id, newJson);
  }

  async delete(id: string): Promise<void> {
    const existing = await this.get(id);
    if (existing == null) {
      return;
    }
    await this.db.delete("post", { id });

    // TODO: This is not suffficient if there are still pending Creates!
    // The pending Creates should be canceled.
    // Also a Delete should probably just be spammed to the whole network.

    await this.activityDispatchStore.createAndDispatch(
      await this.activityDispatchStore.inboxesWhichReceived(id),
      this.apGen.publicActivity(existing.persona, {
        type: "Delete",
        target: urls.activityPubObject(id, this.config.url),
      }),
    );
  }
}
