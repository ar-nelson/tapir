import { Handlers, RouteConfig } from "$fresh/server.ts";
import { Head } from "$fresh/runtime.ts";
import { LocalPost, localPostStore } from "../models/LocalPost.ts";
import { Persona, personaStore } from "../models/Persona.ts";
import { ServerConfig, serverConfigStore } from "../models/ServerConfig.ts";
import { Toot } from "../components/Toot.tsx";

export const config: RouteConfig = {
  routeOverride: "/@:name",
};

export const handler: Handlers = {
  async GET(_req, ctx) {
    const serverConfig = await serverConfigStore.getServerConfig();
    const persona = await personaStore.getPersona(ctx.params.name);
    // if (!persona) {
    //   return ctx.renderNotFound();
    // }
    const posts = await localPostStore.listPosts(ctx.params.name);
    return ctx.render({ serverConfig, persona, posts });
  },
};

export default function PersonaTimeline(
  { data: { serverConfig, persona, posts } }: {
    data: {
      serverConfig: ServerConfig;
      persona: Persona;
      posts: readonly LocalPost[];
    };
  },
) {
  return (
    <>
      <Head>
        <title>
          {persona.displayName} (@{persona.name}@{serverConfig.domain})
        </title>
      </Head>
      <header>
        <h1>{persona.displayName} (@{persona.name}@{serverConfig.domain})</h1>
      </header>
      <hr />
      <main>
        {posts.map((post) => (
          <>
            <Toot
              authorName={persona.name}
              authorServer={serverConfig.domain}
              authorDisplayName={persona.displayName}
              authorUrl={`/@${persona.name}`}
              permalinkUrl={`${serverConfig.url}/toot/${post.id}`}
              createdAt={new Date(post.createdAt)}
              content={post.content}
              likes={0}
              boosts={0}
            />
            <hr />
          </>
        ))}
      </main>
    </>
  );
}
