import { LocalPostStore, PostType } from "$/models/LocalPost.ts";
import { ServerConfigStore } from "$/models/ServerConfig.ts";
import { Persona, PersonaStore } from "$/models/Persona.ts";
import { InFollow, InFollowStore } from "$/models/InFollow.ts";
import { LocalAttachmentStore } from "$/models/LocalAttachment.ts";
import {
  FollowDetail,
  FollowRequestDetail,
  UserDetail,
} from "$/views/types.ts";
import { Singleton } from "$/lib/inject.ts";
import { asyncToArray } from "$/lib/utils.ts";
import * as urls from "$/lib/urls.ts";
import { FormDataBody, log } from "$/deps.ts";

interface PersonaFollows {
  persona: Persona;
  followers: FollowDetail[];
  requests: FollowRequestDetail[];
}

@Singleton()
export class SettingsController {
  constructor(
    private readonly serverConfigStore: ServerConfigStore,
    private readonly personaStore: PersonaStore,
    private readonly localPostStore: LocalPostStore,
    private readonly localAttachmentStore: LocalAttachmentStore,
    private readonly inFollowStore: InFollowStore,
  ) {}

  async #userDetail(): Promise<UserDetail> {
    const serverConfig = await this.serverConfigStore.getServerConfig(),
      personas = await asyncToArray(this.personaStore.list());
    return {
      serverName: serverConfig.displayName,
      personas,
    };
  }

  async #followDetail(f: InFollow): Promise<FollowRequestDetail> {
    return {
      id: f.id,
      url: f.actor,
      name: `${f.name}@${new URL(f.server).host}`,
      displayName: f.name,
      avatarUrl: "",
    };
  }

  async settingsRoot(): Promise<{ user: UserDetail }> {
    return { user: await this.#userDetail() };
  }

  async personasForm(): Promise<{ user: UserDetail; personas: Persona[] }> {
    return {
      user: await this.#userDetail(),
      personas: await asyncToArray(this.personaStore.list()),
    };
  }

  async newPersonaForm(): Promise<{ user: UserDetail }> {
    return { user: await this.#userDetail() };
  }

  async doCreatePersona(): Promise<void> {
    throw new Error("Not yet supported");
  }

  async editPersonaForm(
    personaName: string,
  ): Promise<{ user: UserDetail; persona: Persona }> {
    return {
      user: await this.#userDetail(),
      persona: (await this.personaStore.get(personaName))!,
    };
  }

  async doUpdatePersona(
    personaName: string,
    form: FormDataBody,
  ): Promise<void> {
    await this.personaStore.update(personaName, {
      displayName: form.fields.displayName,
      linkTitle: form.fields.linkTitle,
      summary: form.fields.summary,
    });
  }

  async followersForm(): Promise<
    {
      user: UserDetail;
      followersByPersona: PersonaFollows[];
    }
  > {
    const followersByPersona: PersonaFollows[] = [];
    for await (const persona of this.personaStore.list()) {
      followersByPersona.push({
        persona,
        followers: await Promise.all((await asyncToArray(
          this.inFollowStore.listFollowers(persona.name),
        )).map((f) => this.#followDetail(f))),
        requests: await Promise.all((await asyncToArray(
          this.inFollowStore.listRequests(persona.name),
        )).map((f) => this.#followDetail(f))),
      });
    }
    return { user: await this.#userDetail(), followersByPersona };
  }

  async doAcceptFollow(id: string): Promise<void> {
    await this.inFollowStore.accept({ id });
  }

  async doRejectFollow(id: string): Promise<void> {
    await this.inFollowStore.reject({ id });
  }

  async composeForm(): Promise<{ user: UserDetail; personas: Persona[] }> {
    return {
      user: await this.#userDetail(),
      personas: await asyncToArray(this.personaStore.list()),
    };
  }

  async doCreatePost(form: FormDataBody): Promise<string> {
    const id = await this.localPostStore.create({
      type: PostType.Note,
      persona: form.fields.persona!,
      content: form.fields.content!,
    }, async (postId) => {
      const imageFile = form.files?.find((f) => f.name === "image");
      if (imageFile && imageFile.content) {
        log.info("got a File!");
        const attachment = await this.localAttachmentStore.createImage({
          postId,
          data: imageFile.content,
          alt: form.fields.alt,
          compress: true,
        });
        return [attachment];
      } else {
        log.warning("no image");
      }
      return [];
    });
    return urls.localPost(id, {});
  }
}
