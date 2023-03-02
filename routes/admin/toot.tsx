import { Handlers } from "$fresh/server.ts";
import { Head } from "$fresh/runtime.ts";
import { Injector } from "$/lib/inject.ts";
import { LocalPostStore, PostType } from "$/models/LocalPost.ts";
import { LocalAttachmentStore } from "$/models/LocalAttachment.ts";
import { Persona, PersonaStore } from "$/models/Persona.ts";
import * as urls from "$/lib/urls.ts";
import { asyncToArray } from "$/lib/utils.ts";
import { log, multiParser } from "$/deps.ts";

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
      localPostStore = await ctx.state.injector.resolve(LocalPostStore),
      localAttachmentStore = await ctx.state.injector.resolve(
        LocalAttachmentStore,
      );
    try {
      const form = await multiParser(req);
      if (!form) {
        throw new Error("did not receive valid multipart form data");
      }
      const id = await localPostStore.create({
        type: PostType.Note,
        persona: form.fields.persona!,
        content: form.fields.content!,
      }, async (postId) => {
        if (form.files.image && !Array.isArray(form.files.image)) {
          log.info("got a File!");
          const attachment = await localAttachmentStore.createImage({
            postId,
            data: form.files.image.content,
            alt: form.fields.alt,
            compress: true,
          });
          return [attachment];
        } else {
          log.warning("no image");
        }
        return [];
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
        <form method="post" encType="multipart/form-data">
          <p>
            <label htmlFor="persona">
              Tooting as persona:
              <select name="persona" id="persona">
                {personas.map((p) => (
                  <option value={p.name}>{p.displayName} (@{p.name})</option>
                ))}
              </select>
            </label>
          </p>
          <p>
            <label htmlFor="content">
              Your content:
              <br />
              <textarea name="content" id="content"></textarea>
            </label>
          </p>
          <p>
            <label htmlFor="image">
              Image attachment:
              <input type="file" name="image" id="image" accept="image/*" />
            </label>
          </p>
          <p>
            <label htmlFor="alt">
              Image alt text:
              <br />
              <textarea name="alt" id="alt"></textarea>
            </label>
          </p>
          <p>
            <input type="submit" value="speak forth" />
          </p>
        </form>
      </main>
    </>
  );
}
