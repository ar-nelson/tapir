export interface LocalPost {
  id: string;
  persona: string;
  createdAt: string;
  content: string;
}

export interface LocalPostStore {
  listPosts(
    persona: string,
    pageSize?: number,
    startAtId?: string,
  ): Promise<readonly LocalPost[]>;
  getPost(id: string): Promise<LocalPost | null>;
}

const MOCK_POSTS: readonly LocalPost[] = [{
  id: "01GREP1D6Z1DF4KQJ0XR8RQW2H",
  persona: "tapir",
  createdAt: "2023-02-04T12:02:13-0500",
  content:
    `Tapir is based on Deno (<a rel="nofollow noopener noreferrer" href="https://fosstodon.org/@deno_land">@deno_land</a>) and the Fresh web framework. The goal is to be installable from a URL with a single command.`,
}, {
  id: "01GRCXZ3EP8A9XZXDAT5Z6JAG2",
  persona: "tapir",
  createdAt: "2023-02-03T19:42:26-0500",
  content: "just setting up my tpir",
}];

export class MockLocalPostStore implements LocalPostStore {
  async listPosts(persona: string): Promise<readonly LocalPost[]> {
    return persona === "tapir" ? MOCK_POSTS : [];
  }
  async getPost(id: string): Promise<LocalPost | null> {
    return MOCK_POSTS.find((it) => it.id === id) ?? null;
  }
}

export const localPostStore = new MockLocalPostStore();
