import { Handlers } from "$fresh/server.ts";
import { Head } from "$fresh/runtime.ts";
import { Injector } from "$/lib/inject.ts";
import { Persona, PersonaStore } from "$/models/Persona.ts";
import { InFollow, InFollowStore } from "$/models/InFollow.ts";
import { asyncToArray } from "$/lib/utils.ts";

interface PersonaFollows {
  persona: Persona;
  follows: InFollow[];
  requests: InFollow[];
}

interface Params {
  followsByPersona: PersonaFollows[];
}

export const handler: Handlers<Params, { injector: Injector }> = {
  async GET(_req, ctx) {
    const personaStore = await ctx.state.injector.resolve(PersonaStore),
      inFollowStore = await ctx.state.injector.resolve(InFollowStore),
      followsByPersona: PersonaFollows[] = [];
    for await (const persona of personaStore.list()) {
      followsByPersona.push({
        persona,
        follows: await asyncToArray(inFollowStore.listFollowers(persona.name)),
        requests: await asyncToArray(inFollowStore.listRequests(persona.name)),
      });
    }
    return ctx.render({ followsByPersona });
  },
};

function FollowerLink({ follow }: { follow: InFollow }) {
  return (
    <a href={follow.actor}>@{follow.name}@{new URL(follow.server).hostname}</a>
  );
}

function PostButton(
  { url, id, text }: { url: string; id: string; text: string },
) {
  return (
    <form method="post" action={url} style={{ display: "inline-block" }}>
      <input type="hidden" name="id" value={id} />
      <input type="submit" value={text} />
    </form>
  );
}

function Section({ persona, follows, requests }: PersonaFollows) {
  return (
    <section>
      <h2>{persona.displayName} (@{persona.name})</h2>
      <section>
        <h3>Followers ({follows.length})</h3>
        <ul>
          {follows.map((f) => (
            <li>
              <FollowerLink follow={f} />
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h3>Follow Requests ({requests.length})</h3>
        <ul>
          {requests.map((r) => (
            <li>
              <FollowerLink follow={r} /> -{" "}
              <PostButton
                url="/admin/followers/accept"
                id={r.id}
                text="Accept"
              />{" "}
              -{" "}
              <PostButton
                url="/admin/followers/reject"
                id={r.id}
                text="Reject"
              />
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}

export default function ListPersonas(
  { data: { followsByPersona } }: { data: Params },
) {
  return (
    <>
      <Head>
        <title>tapir admin: followers</title>
      </Head>
      <header>
        <h1>tapir admin: followers</h1>
        <p>
          <a href="/admin">← return from whence you came</a>
        </p>
      </header>
      <hr />
      <main>
        {followsByPersona.map((f) => (
          <>
            <Section {...f} />
            <hr />
          </>
        ))}
      </main>
    </>
  );
}
