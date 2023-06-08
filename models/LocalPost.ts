import { Status } from "$/deps.ts";
import { logError, LogLevels, Tag } from "$/lib/error.ts";
import { InjectableAbstract, Singleton } from "$/lib/inject.ts";
import { ColumnsOf, OrderDirection, OutRow, Q } from "$/lib/sql/mod.ts";
import {
  LocalAttachment,
  LocalPost,
  parseProtoAddr,
  protoAddrToString,
} from "$/models/types.ts";
import { LocalDatabaseTables } from "$/schemas/tapir/db/local/mod.ts";
import { LocalDatabaseService } from "$/services/LocalDatabaseService.ts";
import { PublisherService } from "$/services/PublisherService.ts";
import { UlidService } from "$/services/UlidService.ts";

export interface PostUpdate {
  readonly contentHtml: string;
  readonly contentRaw?: string;
  readonly contentRawMimetype?: string;
  readonly contentWarning?: string | null;
}

export const PostNotFound = new Tag("Local Post Not Found", {
  level: LogLevels.WARNING,
  internal: false,
  httpStatus: Status.NotFound,
});
export const CreatePostFailed = new Tag("Create Post Failed");
export const UpdatePostFailed = new Tag("Update Post Failed");
export const DeletePostFailed = new Tag("Delete Post Failed");

@InjectableAbstract()
export abstract class LocalPostStore {
  abstract list(options?: {
    readonly persona?: string;
    readonly limit?: number;
    readonly beforeId?: string;
    readonly order?: OrderDirection;
  }): AsyncIterable<LocalPost>;

  abstract count(persona?: string): Promise<number>;

  abstract get(id: string): Promise<LocalPost>;

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
    private readonly publisherService: PublisherService,
    private readonly ulid: UlidService,
  ) {
    super();
  }

  #rowToObject(row: OutRow<ColumnsOf<LocalDatabaseTables, "post">>): LocalPost {
    return {
      ...row,
      contentHtml: row.contentHtml ?? undefined,
      contentRaw: row.contentRaw ?? undefined,
      contentRawMimetype: row.contentRawMimetype ?? undefined,
      contentWarning: row.contentWarning ?? undefined,
      targetPost: row.targetPost ? parseProtoAddr(row.targetPost) : undefined,
      updatedAt: row.updatedAt ?? undefined,
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
      yield this.#rowToObject(p);
    }
  }

  count(persona?: string): Promise<number> {
    return Promise.resolve(
      this.db.count("post", persona ? { persona } : {}),
    );
  }

  async get(id: string): Promise<LocalPost> {
    for await (const p of this.db.get("post", { where: { id } })) {
      return this.#rowToObject(p);
    }
    throw PostNotFound.error(`No local post with ID ${id}`);
  }

  async create(
    post: Omit<LocalPost, "id" | "createdAt" | "updatedAt">,
    createAttachments?: (id: string) => Promise<readonly LocalAttachment[]>,
  ): Promise<string> {
    const id = this.ulid.next(), createdAt = new Date();
    let attachments: readonly LocalAttachment[] = [];
    try {
      await this.db.insert("post", [{
        ...post,
        targetPost: post.targetPost && protoAddrToString(post.targetPost),
        id,
        createdAt,
      }]);
      attachments = createAttachments ? await createAttachments(id) : [];
      await this.publisherService.createPost(
        { ...post, id, createdAt },
        attachments,
      );
      return id;
    } catch (e) {
      try {
        await this.db.delete("post", { id });
        if (attachments.length) {
          await this.db.delete("attachment", {
            id: Q.in(attachments.map((a) => a.id)),
          });
        }
      } catch (e) {
        logError(
          "Failed to delete post after failing to dispatch it, database may be in an inconsistent state",
          e,
        );
      }
      throw CreatePostFailed.wrap(e);
    }
  }

  async update(id: string, update: PostUpdate): Promise<void> {
    try {
      const existing = await this.get(id);
      if (existing.contentHtml == null) {
        throw UpdatePostFailed.error(
          `Post ${id} does not have text content, thus cannot be updated`,
        );
      }
      const updatedAt = new Date(),
        newPost = {
          ...existing,
          contentHtml: update.contentHtml ?? existing.contentHtml,
          contentRaw: update.contentRaw ?? existing.contentRaw,
          contentRawMimetype: update.contentRawMimetype ??
            existing.contentRawMimetype,
          contentWarning: update.contentWarning === undefined
            ? existing.contentWarning
            : (update.contentWarning ?? undefined),
          updatedAt,
        };
      await this.db.update("post", { id }, {
        ...update,
        updatedAt,
      });
      await this.publisherService.updatePost(newPost);
    } catch (e) {
      throw UpdatePostFailed.wrap(e);
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const existing = await this.get(id);
      if (existing == null) {
        return;
      }
      await this.db.delete("post", { id });
      await this.publisherService.deletePost(id);
    } catch (e) {
      throw DeletePostFailed.wrap(e);
    }
  }
}
