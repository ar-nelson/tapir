import { InjectableAbstract, Singleton } from "$/lib/inject.ts";
import { DatabaseService } from "$/services/DatabaseService.ts";
import { OrderDirection, Q } from "$/lib/sql/mod.ts";
import { LocalDatabaseSpec, PostType } from "$/schemas/tapir/LocalDatabase.ts";
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
    private readonly db: DatabaseService<typeof LocalDatabaseSpec>,
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

const MOCK_POSTS: readonly LocalPost[] = [{
  id: "01GS3EACBSFYB8C1FMHTSEWJZY",
  type: PostType.Note,
  persona: "tapir",
  createdAt: "2023-02-11T21:32:14-0500",
  updatedAt: "2023-02-12T08:52:15-0500",
  content:
    `Tapir Fact: Tapirs don't like to be followed. In fact, you could say they "reject all follow requests" because they "don't support that feature yet". Please don't take it personally.`,
}, {
  id: "01GS3E7MSAE3C7E68YGED07CF7",
  type: PostType.Note,
  persona: "tapir",
  createdAt: "2023-02-11T21:11:57-0500",
  updatedAt: "2023-02-12T08:52:15-0500",
  content: "oops, my timeline is backwards",
}, {
  id: "01GS3E7MAH1NMKRRMT1GKZ28GK",
  type: PostType.Note,
  persona: "tapir",
  createdAt: "2023-02-11T20:51:23-0500",
  updatedAt: "2023-02-12T08:52:15-0500",
  content: "is this a xonk",
}, {
  id: "01GS3E7KVNSK7CS4HDAFA2P2GS",
  type: PostType.Note,
  persona: "tapir",
  createdAt: "2023-02-07T17:44:52-0500",
  updatedAt: "2023-02-12T08:52:15-0500",
  content: "tapir has learned to communicate with activitypub",
}, {
  id: "01GS3E7KAKEBBKSK424XCSQPHV",
  type: PostType.Note,
  persona: "tapir",
  createdAt: "2023-02-05T22:33:19-0500",
  updatedAt: "2023-02-12T08:52:15-0500",
  content: "tapir has learned to communicate with elk",
}, {
  id: "01GS3E7JB1FCC03SKGHJ3V294A",
  type: PostType.Note,
  persona: "tapir",
  createdAt: "2023-02-04T12:02:13-0500",
  updatedAt: "2023-02-12T08:52:15-0500",
  content:
    `Tapir is based on Deno (<a rel="nofollow noopener noreferrer" href="https://fosstodon.org/@deno_land">@deno_land</a>) and the Fresh web framework. The goal is to be installable from a URL with a single command.`,
}, {
  id: "01GS3E7HHDRQRPN8YVEPK091SF",
  type: PostType.Note,
  persona: "tapir",
  createdAt: "2023-02-03T19:42:26-0500",
  updatedAt: "2023-02-12T08:52:15-0500",
  content: "just setting up my tpir",
}];

export class MockLocalPostStore extends LocalPostStore {
  async *list(options: {
    persona?: string;
    limit?: number;
    beforeId?: string;
  } = {}): AsyncIterable<LocalPost> {
    if (options.persona == null || options.persona === "tapir") {
      for (let i = 0; i < (options.limit ?? MOCK_POSTS.length); i++) {
        yield MOCK_POSTS[i];
      }
    }
  }

  count(persona?: string): Promise<number> {
    return Promise.resolve(
      persona == null || persona === "tapir" ? MOCK_POSTS.length : 0,
    );
  }

  get(id: string): Promise<LocalPost | null> {
    return Promise.resolve(MOCK_POSTS.find((it) => it.id === id) ?? null);
  }

  create(): Promise<string> {
    return Promise.reject(new Error("create not supported"));
  }

  update(): Promise<void> {
    return Promise.reject(new Error("update not supported"));
  }

  delete(): Promise<void> {
    return Promise.reject(new Error("delete not supported"));
  }
}
