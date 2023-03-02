import { Handlers } from "$fresh/server.ts";
import { Head } from "$fresh/runtime.ts";
import { Injector } from "$/lib/inject.ts";
import { LocalPost, LocalPostStore } from "$/models/LocalPost.ts";
import {
  AttachmentType,
  LocalAttachment,
  LocalAttachmentStore,
} from "$/models/LocalAttachment.ts";
import { Persona, PersonaStore } from "$/models/Persona.ts";
import { ServerConfig, ServerConfigStore } from "$/models/ServerConfig.ts";
import { Toot } from "$/components/Toot.tsx";
import { asyncToArray } from "$/lib/utils.ts";
import * as urls from "$/lib/urls.ts";

interface Params {
  serverConfig: ServerConfig;
  persona: Persona;
  post: LocalPost;
  attachments: LocalAttachment[];
}

export const handler: Handlers<Params, { injector: Injector }> = {
  async GET(_req, ctx) {
    const serverConfigStore = await ctx.state.injector.resolve(
        ServerConfigStore,
      ),
      personaStore = await ctx.state.injector.resolve(PersonaStore),
      localPostStore = await ctx.state.injector.resolve(LocalPostStore),
      localAttachmentStore = await ctx.state.injector.resolve(
        LocalAttachmentStore,
      ),
      serverConfig = await serverConfigStore.getServerConfig(),
      post = await localPostStore.get(ctx.params.id);
    if (!post) {
      return ctx.renderNotFound();
    }
    const persona = await personaStore.get(post.persona);
    if (!persona) {
      return ctx.renderNotFound();
    }
    return ctx.render({
      serverConfig,
      persona,
      post,
      attachments: await asyncToArray(localAttachmentStore.list(ctx.params.id)),
    });
  },
};

export default function SinglePost(
  { data: { serverConfig, persona, post, attachments } }: { data: Params },
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
          content={post.content ?? ""}
          images={attachments.filter((a) => a.type === AttachmentType.Image)
            .map((a) => ({
              src: urls.localMedia(a.original),
              alt: a.alt ?? undefined,
            }))}
          likes={0}
          boosts={0}
        />
      </main>
    </>
  );
}
