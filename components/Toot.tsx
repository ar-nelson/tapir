export function Toot(params: {
  authorName: string;
  authorServer: string;
  authorDisplayName: string;
  authorUrl: string;
  permalinkUrl: string;
  createdAt: Date;
  content: string;
  likes: number;
  boosts: number;
}) {
  return (
    <article>
      <header>
        <a href={params.authorUrl}>
          {params.authorDisplayName}{" "}
          (@{params.authorName}@{params.authorServer})
        </a>{" "}
        ·{" "}
        <time dateTime={params.createdAt.toISOString()}>
          {params.createdAt.toLocaleString()}
        </time>
      </header>
      <blockquote dangerouslySetInnerHTML={{ __html: params.content }} />
      <footer>
        <small>Likes: {params.likes}</small> ·{" "}
        <small>Boosts: {params.boosts}</small> ·{" "}
        <small>
          <a href={params.permalinkUrl}>Permalink</a>
        </small>
      </footer>
    </article>
  );
}
