import { Handlers } from "$fresh/server.ts";
import { Head } from "$fresh/runtime.ts";
import { Injector } from "$/lib/inject.ts";
import { LocalPostStore, PostType } from "$/models/LocalPost.ts";
import { Persona, PersonaStore } from "$/models/Persona.ts";
import * as urls from "$/lib/urls.ts";
import { asyncToArray } from "$/lib/utils.ts";
import * as log from "https://deno.land/std@0.176.0/log/mod.ts";

interface Params {
  personas: Persona[];
  posted?: string;
  error?: string;
}

export const handler: Handlers<Params, { injector: Injector }> = {
  async GET(_req, ctx) {
    const personaStore = await ctx.state.injector.resolve(PersonaStore),
      personas = await asyncToArray(personaStore.list());
    return ctx.render({ personas });
  },
  async POST(req, ctx) {
    const personaStore = await ctx.state.injector.resolve(PersonaStore),
      personas = await asyncToArray(personaStore.list()),
      localPostStore = await ctx.state.injector.resolve(LocalPostStore);
    try {
      const formData = await req.formData(),
        id = await localPostStore.create({
          type: PostType.Note,
          persona: formData.get("persona")!.toString(),
          content: formData.get("content")!.toString(),
        });
      return ctx.render({
        personas,
        posted: urls.localPost(id, "/"),
      });
    } catch (e) {
      log.error(e);
      return ctx.render({ personas, error: e.message ?? `${e}` });
    }
  },
};

export default function NewToot(
  { data: { personas, posted, error } }: { data: Params },
) {
  return (
    <>
      <Head>
        <title>tapir admin: new toot</title>
      </Head>
      <header>
        <h1>tapir admin: new toot</h1>
        <p>
          <a href="/admin">← return from whence you came</a>
        </p>
      </header>
      <hr />
      {posted &&
        (
          <aside>
            <b>
              Successfully tooted! <a href={posted}>See your new toot?</a>
            </b>
          </aside>
        )}
      {error &&
        (
          <aside>
            <strong>ERROR: {error}</strong>
          </aside>
        )}
      <main>
        <form method="post">
          <label htmlFor="persona">
            Tooting as persona:
            <select name="persona" id="persona">
              {personas.map((p) => (
                <option value={p.name}>{p.displayName} (@{p.name})</option>
              ))}
            </select>
          </label>
          <br />
          <br />
          <label htmlFor="content">
            Your content:
            <br />
            <textarea name="content" id="content"></textarea>
          </label>
          <br />
          <br />
          <input type="submit" value="speak forth" />
        </form>
      </main>
    </>
  );
}
