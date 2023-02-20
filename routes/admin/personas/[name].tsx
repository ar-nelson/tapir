import { Handlers } from "$fresh/server.ts";
import { Head } from "$fresh/runtime.ts";
import { Injector } from "$/lib/inject.ts";
import { Persona, PersonaStore } from "$/models/Persona.ts";

interface Params {
  persona: Persona;
  updated?: boolean;
  error?: string;
}

export const handler: Handlers<Params, { injector: Injector }> = {
  async GET(_req, ctx) {
    const personaStore = await ctx.state.injector.resolve(PersonaStore),
      persona = await personaStore.get(ctx.params.name);
    if (persona == null) {
      return ctx.renderNotFound();
    }
    return ctx.render({ persona });
  },
  async POST(req, ctx) {
    const personaStore = await ctx.state.injector.resolve(PersonaStore),
      persona = await personaStore.get(ctx.params.name);
    if (persona == null) {
      return ctx.renderNotFound();
    }
    try {
      const formData = await req.formData();
      await personaStore.update(ctx.params.name, {
        displayName: formData.get("displayName")!.toString(),
        summary: formData.get("summary")!.toString(),
      });
      return ctx.render({ persona, updated: true });
    } catch (e) {
      return ctx.render({ persona, error: e.message ?? `${e}` });
    }
  },
};

export default function UpdatePersona(
  { data: { persona, updated, error } }: { data: Params },
) {
  return (
    <>
      <Head>
        <title>tapir admin: edit persona @{persona.name}</title>
      </Head>
      <header>
        <h1>tapir admin: edit persona @{persona.name}</h1>
        <p>
          <a href="/admin/personas">← return from whence you came</a>
        </p>
      </header>
      <hr />
      {updated &&
        (
          <aside>
            <strong>Successfully updated profile!</strong>
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
          <label htmlFor="displayName">
            Display name:
            <input
              type="text"
              value={persona.displayName}
              name="displayName"
              id="displayName"
            />
          </label>
          <br />
          <br />
          <label htmlFor="summary">
            Summary blurb:
            <br />
            <textarea name="summary" id="summary">{persona.summary}</textarea>
          </label>
          <br />
          <br />
          <input type="submit" value="refine your identity" />
        </form>
      </main>
    </>
  );
}
