import { InjectableAbstract, Singleton } from "$/lib/inject.ts";
import { DatabaseService, Order, QueryOp } from "$/services/DatabaseService.ts";
import { LocalDatabaseSpec, PostType } from "$/schemas/tapir/LocalDatabase.ts";
import { UlidService } from "$/services/UlidService.ts";

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
  private readonly table;

  constructor(
    db: DatabaseService<typeof LocalDatabaseSpec>,
    private readonly ulid: UlidService,
  ) {
    super();
    this.table = db.table("localPost");
  }

  async *list({ persona, limit, beforeId }: {
    persona?: string;
    limit?: number;
    beforeId?: string;
  } = {}): AsyncIterable<LocalPost> {
    for await (
      const p of this.table.get({
        where: {
          ...(persona != null ? { persona: [QueryOp.Eq, persona] } : {}),
          ...(beforeId != null ? { id: [QueryOp.Lt, beforeId] } : {}),
        },
        orderBy: [["id", Order.Descending]],
        limit,
      })
    ) {
      yield {
        ...p,
        content: p.content ?? undefined,
        collapseSummary: p.collapseSummary ?? undefined,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt?.toISOString(),
      };
    }
  }

  count(persona?: string): Promise<number> {
    return Promise.resolve(
      this.table.count(persona ? { persona: [QueryOp.Eq, persona] } : {}),
    );
  }

  async get(id: string): Promise<LocalPost | null> {
    for await (const p of this.table.get({ where: { id: [QueryOp.Eq, id] } })) {
      return {
        ...p,
        content: p.content ?? undefined,
        collapseSummary: p.collapseSummary ?? undefined,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt?.toISOString(),
      };
    }
    return null;
  }

  async create(
    post: Omit<LocalPost, "id" | "createdAt" | "updatedAt">,
  ): Promise<string> {
    const id = this.ulid.next();
    await this.table.insert([{
      ...post,
      id,
      content: post.content ?? null,
      updatedAt: null,
      createdAt: new Date(),
      collapseSummary: post.collapseSummary ?? null,
      targetLocalPost: null,
      targetRemotePost: null,
    }]);
    return id;
  }

  async update(id: string, update: PostUpdate): Promise<void> {
    const existing = await this.get(id);
    if (existing == null) {
      throw new Error(`Cannot update post ${id}: post does not exist`);
    }
    if (existing.content == null) {
      throw new Error(
        `Cannot update post ${id}: post does not have text content`,
      );
    }
    await this.table.update({ id: [QueryOp.Eq, id] }, {
      content: update.content,
      collapseSummary: update.collapseSummary ?? null,
      updatedAt: new Date(),
    });
  }

  async delete(id: string): Promise<void> {
    await this.table.delete({ id: [QueryOp.Eq, id] });
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
