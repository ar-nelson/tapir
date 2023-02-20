import { Handlers } from "$fresh/server.ts";
import { Head } from "$fresh/runtime.ts";
import { Injector } from "$/lib/inject.ts";
import { Persona, PersonaStore } from "$/models/Persona.ts";
import { asyncToArray } from "$/lib/utils.ts";

interface Params {
  personas: Persona[];
}

export const handler: Handlers<Params, { injector: Injector }> = {
  async GET(_req, ctx) {
    const personaStore = await ctx.state.injector.resolve(PersonaStore),
      personas = await asyncToArray(personaStore.list());
    return ctx.render({ personas });
  },
};

export default function ListPersonas({ data: { personas } }: { data: Params }) {
  return (
    <>
      <Head>
        <title>tapir admin: personas</title>
      </Head>
      <header>
        <h1>tapir admin: personas</h1>
        <p>
          <a href="/admin">← return from whence you came</a>
        </p>
      </header>
      <hr />
      <main>
        <ul>
          {personas.map((p) => (
            <li>
              <a href={`/admin/personas/${encodeURIComponent(p.name)}`}>
                {p.displayName} (@{p.name})
              </a>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
