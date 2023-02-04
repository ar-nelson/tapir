import { Handlers } from "$fresh/server.ts";
import { Injector } from "$/lib/inject.ts";
import { LocalPost, LocalPostStore } from "$/models/LocalPost.ts";
import { Persona, PersonaStore } from "$/models/Persona.ts";
import { ServerConfig, ServerConfigStore } from "$/models/ServerConfig.ts";
import { Status } from "$/schemas/mastodon/Status.ts";
import { Account } from "$/schemas/mastodon/Account.ts";

const personaToAccount = (
  persona: Persona,
  serverConfig: ServerConfig,
): Account => {
  return {
    id: persona.name,
    username: persona.name,
    acct: persona.name,
    display_name: persona.displayName,
    locked: true,
    bot: false,
    discoverable: true,
    group: false,
    created_at: persona.createdAt,
    note: "",
    url: `${serverConfig.url}/@${persona.name}`,
    avatar: `${serverConfig.url}/tapir.jpg`,
    avatar_static: `${serverConfig.url}/tapir.jpg`,
    header: "",
    header_static: "",
    followers_count: 0,
    following_count: 0,
    statuses_count: 0,
    last_status_at: persona.createdAt,
    emojis: [],
    fields: [],
  };
};

const localPostToMastodon = (persona: Persona, serverConfig: ServerConfig) =>
(
  post: LocalPost,
): Status => {
  return {
    id: post.id,
    created_at: post.createdAt,
    in_reply_to_id: null,
    in_reply_to_account_id: null,
    sensitive: false,
    spoiler_text: "",
    visibility: "public",
    language: "en",
    uri: `${serverConfig.url}/toot/${post.id}`,
    url: `${serverConfig.url}/toot/${post.id}`,
    replies_count: 0,
    reblogs_count: 0,
    favourites_count: 0,
    edited_at: null,
    content: post.content,
    reblog: null,
    application: {
      name: "Tapir",
      website: "https://tapir.social",
    },
    account: personaToAccount(persona, serverConfig),
    media_attachments: [],
    mentions: [],
    tags: [],
    emojis: [],
    card: null,
    poll: null,
  };
};

export const handler: Handlers<void, { injector: Injector }> = {
  async GET(_req, ctx) {
    const serverConfigStore = ctx.state.injector.resolve(ServerConfigStore),
      personaStore = ctx.state.injector.resolve(PersonaStore),
      localPostStore = ctx.state.injector.resolve(LocalPostStore),
      serverConfig = await serverConfigStore.getServerConfig(),
      personas = await personaStore.listPersonas(),
      posts = await Promise.all(
        personas.map((p) => localPostStore.listPosts(p.name)),
      );
    return new Response(
      JSON.stringify(
        posts.flat().map(localPostToMastodon(personas[0], serverConfig)),
      ),
      {
        headers: {
          "content-type": "application/json",
        },
      },
    );
  },
};
