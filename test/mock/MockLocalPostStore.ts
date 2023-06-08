import { Singleton } from "$/lib/inject.ts";
import { LocalPostStore, PostNotFound } from "$/models/LocalPost.ts";
import { LocalPost } from "$/models/types.ts";
import { LOCAL_POSTS, MockPersonaName } from "$/test/mock/mock-data.ts";

@Singleton()
export class MockLocalPostStore extends LocalPostStore {
  async *list(options: {
    persona?: string;
    limit?: number;
    beforeId?: string;
  } = {}): AsyncIterable<LocalPost> {
    if (
      options.persona == null || Object.hasOwn(LOCAL_POSTS, options.persona)
    ) {
      const posts = options.persona
        ? LOCAL_POSTS[options.persona as MockPersonaName]
        : Object.values(LOCAL_POSTS).flat();
      for (
        let i = 0;
        i < Math.min(options.limit ?? posts.length, posts.length);
        i++
      ) {
        yield posts[i];
      }
    }
  }

  count(persona?: string): Promise<number> {
    const posts = persona
      ? LOCAL_POSTS[persona as MockPersonaName]
      : Object.values(LOCAL_POSTS).flat();
    return Promise.resolve(posts ? posts.length : 0);
  }

  get(id: string): Promise<LocalPost> {
    const post = Object.values(LOCAL_POSTS).flat().find((it) => it.id === id);
    return post
      ? Promise.resolve(post)
      : Promise.reject(PostNotFound.error(`No post with ID ${id}`));
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
