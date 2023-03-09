import { view } from "$/lib/html.ts";
import { PostDetail } from "$/views/types.ts";
import { Attachment } from "$/views/components/Attachment.tsx";
import { RelativeDateTime } from "$/views/components/RelativeDateTime.tsx";
import { Icon } from "$/views/components/Icon.tsx";
import { sprintf } from "$/deps.ts";

export const Post = view<
  { post: PostDetail; controls?: boolean; big?: boolean }
>(({ post, big = false }, { strings }) => {
  const body = (
    <>
      <div class="post-body">
        {post.content}
      </div>
      {post.attachments.map((attachment) => (
        <Attachment attachment={attachment} />
      ))}
    </>
  );
  return (
    <article class={`post${big ? " post-big" : ""}`} id={`post-${post.id}`}>
      <header>
        <h3 class="post-heading">
          <a href={post.author.url}>
            <span class="author-display-name">{post.author.displayName}</span>
            {" "}
            <span class="author-name">({post.author.name})</span>
          </a>{" "}
          <span class="a11y-hidden">-{" "}</span>
          <a href={post.url}>
            <RelativeDateTime date={post.createdAt} />
          </a>
        </h3>
        <span class="avatar">
          <img
            aria-hidden="true"
            src={post.author.avatarUrl}
            alt={sprintf(strings.post.avatarAlt, post.author.displayName)}
          />
        </span>
      </header>
      {post.collapseSummary
        ? (
          <details>
            <summary>{post.collapseSummary}</summary>
            <div>{body}</div>
          </details>
        )
        : body}
      <footer>
        <dl>
          <dt>
            <Icon icon="message-circle" title={strings.post.replies} />
          </dt>
          <dd>0</dd>
          <dt>
            <Icon icon="repeat" title={strings.post.boosts} />
          </dt>
          <dd>0</dd>
          <dt>
            <Icon icon="star" title={strings.post.reactions} />
          </dt>
          <dd>0</dd>
        </dl>
      </footer>
    </article>
  );
});
