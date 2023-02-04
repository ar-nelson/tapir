export default function Post(params: {
  authorName: string;
  authorServer: string;
  authorDisplayName: string;
  authorUrl: string;
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
      <blockquote>
        {params.content}
      </blockquote>
      <footer>
        <small>Likes: {params.likes}</small> ·{" "}
        <small>Boosts: {params.boosts}</small>
      </footer>
    </article>
  );
}
