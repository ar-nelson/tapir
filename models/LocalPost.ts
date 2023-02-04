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
