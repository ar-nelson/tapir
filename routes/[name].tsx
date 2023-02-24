import { Handlers, RouteConfig } from "$fresh/server.ts";
import { Head } from "$fresh/runtime.ts";
import { Injector } from "$/lib/inject.ts";
import { LocalPost, LocalPostStore } from "$/models/LocalPost.ts";
import { Persona, PersonaStore } from "$/models/Persona.ts";
import { ServerConfig, ServerConfigStore } from "$/models/ServerConfig.ts";
import { Toot } from "$/components/Toot.tsx";
import { asyncToArray } from "$/lib/utils.ts";
import * as urls from "$/lib/urls.ts";

interface Params {
  serverConfig: ServerConfig;
  persona: Persona;
  posts: readonly LocalPost[];
}

export const config: RouteConfig = {
  routeOverride: "/@:name",
};

export const handler: Handlers<Params, { injector: Injector }> = {
  async GET(req, ctx) {
    const serverConfigStore = await ctx.state.injector.resolve(
        ServerConfigStore,
      ),
      serverConfig = await serverConfigStore.getServerConfig();

    if (urls.contentTypeIsJson(req.headers.get("accept") ?? "")) {
      return Response.redirect(
        urls.activityPubActor(ctx.params.name, serverConfig.url),
      );
    }

    const personaStore = await ctx.state.injector.resolve(PersonaStore),
      localPostStore = await ctx.state.injector.resolve(LocalPostStore),
      persona = await personaStore.get(ctx.params.name);
    if (!persona) {
      return ctx.renderNotFound();
    }
    const posts = await asyncToArray(
      localPostStore.list({ persona: ctx.params.name }),
    );
    return ctx.render({ serverConfig, persona, posts });
  },
};

export default function PersonaTimeline(
  { data: { serverConfig, persona, posts } }: { data: Params },
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
        <p>{persona.summary}</p>
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
              content={post.content ?? ""}
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
