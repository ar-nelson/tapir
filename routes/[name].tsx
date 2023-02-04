import { Handlers, RouteConfig } from "$fresh/server.ts";
import { Head } from "$fresh/runtime.ts";
import { LocalPost, localPostStore } from "../models/LocalPost.ts";
import { Persona, personaStore } from "../models/Persona.ts";
import Post from "../components/Post.tsx";

export const config: RouteConfig = {
  routeOverride: "/@:name",
};

export const handler: Handlers = {
  async GET(_req, ctx) {
    const persona = await personaStore.getPersona(ctx.params.name);
    if (!persona) {
      return ctx.renderNotFound();
    }
    const posts = await localPostStore.listPosts(ctx.params.name);
    return ctx.render({ persona, posts });
  },
};

export default function Greet(
  { data: { persona, posts } }: {
    data: { persona: Persona; posts: readonly LocalPost[] };
  },
) {
  return (
    <>
      <Head>
        <title>{persona.displayName} ({persona.name}@tapir.social)</title>
      </Head>
      <header>
        <h1>{persona.displayName} ({persona.name}@tapir.social)</h1>
      </header>
      <main>
        {posts.map((post) => (
          <Post
            authorName={persona.name}
            authorServer="tapir.social"
            authorDisplayName={persona.displayName}
            authorUrl={`/@${persona.name}`}
            createdAt={new Date(post.createdAt)}
            content={post.content}
            likes={0}
            boosts={0}
          />
        ))}
      </main>
    </>
  );
}
