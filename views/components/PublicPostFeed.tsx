import { view } from "$/lib/html.ts";
import { PostDetail } from "$/views/types.ts";
import { Post } from "$/views/components/Post.tsx";

export const PublicPostFeed = view<
  { posts: PostDetail[]; selectedPost?: string }
>(({ posts, selectedPost }) => (
  <ul class="feed">
    {posts.map((post) => (
      <li>
        <Post post={post} controls={false} big={selectedPost === post.id} />
      </li>
    ))}
  </ul>
));
