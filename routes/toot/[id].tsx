import { Handlers } from "$fresh/server.ts";
import { Head } from "$fresh/runtime.ts";
import { Injector } from "$/lib/inject.ts";
import { LocalPost, LocalPostStore } from "$/models/LocalPost.ts";
import { Persona, PersonaStore } from "$/models/Persona.ts";
import { ServerConfig, ServerConfigStore } from "$/models/ServerConfig.ts";
import { Toot } from "$/components/Toot.tsx";

interface Params {
  serverConfig: ServerConfig;
  persona: Persona;
  post: LocalPost;
}

export const handler: Handlers<Params, { injector: Injector }> = {
  async GET(_req, ctx) {
    const serverConfigStore = ctx.state.injector.resolve(ServerConfigStore),
      personaStore = ctx.state.injector.resolve(PersonaStore),
      localPostStore = ctx.state.injector.resolve(LocalPostStore),
      serverConfig = await serverConfigStore.getServerConfig(),
      post = await localPostStore.getPost(ctx.params.id);
    if (!post) {
      return ctx.renderNotFound();
    }
    const persona = await personaStore.getPersona(post.persona);
    if (!persona) {
      return ctx.renderNotFound();
    }
    return ctx.render({ serverConfig, persona, post });
  },
};

export default function SinglePost(
  { data: { serverConfig, persona, post } }: { data: Params },
) {
  return (
    <>
      <Head>
        <title>
          A post by {persona.displayName}{" "}
          (@{persona.name}@{serverConfig.domain})
        </title>
      </Head>
      <main>
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
      </main>
    </>
  );
}
