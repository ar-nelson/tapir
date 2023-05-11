import {
  Page,
  PostDetail,
  PublicGlobalNav,
  PublicPostFeed,
  ServerDetail,
  view,
} from "$/views/components/mod.ts";
import { sprintf } from "$/deps.ts";

export const PublicFeedPage = view<
  {
    server: ServerDetail;
    posts: PostDetail[];
    selectedPost?: string;
    title?: string;
  }
>(({ server, posts, selectedPost, title }, { strings }) => {
  let pageTitle = server.name;
  if (title) {
    pageTitle = `${server.name} - ${title}`;
  } else {
    const post = posts.find((p) => p.addr.path === selectedPost);
    if (post) {
      pageTitle = `${server.name} - ${
        sprintf(strings.post.title, post.author.displayName, post.author.name)
      }`;
    }
  }
  return (
    <Page title={pageTitle}>
      <div class="page public-page feed-page">
        <PublicGlobalNav server={server} />
        <main>
          {title && <h2 class="a11y-hidden">{title}</h2>}
          <PublicPostFeed posts={posts} selectedPost={selectedPost} />
        </main>
      </div>
    </Page>
  );
});
