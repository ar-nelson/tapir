import { Handlers } from "$fresh/server.ts";
import { Head } from "$fresh/runtime.ts";
import { LocalPost, localPostStore } from "../../models/LocalPost.ts";
import { Persona, personaStore } from "../../models/Persona.ts";
import { ServerConfig, serverConfigStore } from "../../models/ServerConfig.ts";
import { Toot } from "../../components/Toot.tsx";

export const handler: Handlers = {
  async GET(_req, ctx) {
    const serverConfig = await serverConfigStore.getServerConfig();
    const post = await localPostStore.getPost(ctx.params.id);
    if (!post) {
      return ctx.renderNotFound();
    }
    const persona = await personaStore.getPersona(post.persona);
    return ctx.render({ serverConfig, persona, post });
  },
};

export default function SinglePost(
  { data: { serverConfig, persona, post } }: {
    data: {
      serverConfig: ServerConfig;
      persona: Persona;
      post: LocalPost;
    };
  },
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
