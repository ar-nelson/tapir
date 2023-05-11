import { FormDataBody, log } from "$/deps.ts";
import { Singleton } from "$/lib/inject.ts";
import { chainFrom } from "$/lib/transducers.ts";
import * as urls from "$/lib/urls.ts";
import { InFollowStore } from "$/models/InFollow.ts";
import { InstanceConfigStore } from "$/models/InstanceConfig.ts";
import { LocalAttachmentStore } from "$/models/LocalAttachment.ts";
import { LocalPostStore } from "$/models/LocalPost.ts";
import { PersonaStore } from "$/models/Persona.ts";
import { RemoteProfileStore } from "$/models/RemoteProfile.ts";
import { InFollow, Persona, PostType, ProfileType } from "$/models/types.ts";
import {
  FollowRequestDetail,
  ProfileCardDetail,
  UserDetail,
} from "$/views/types.ts";

interface PersonaFollows {
  persona: Persona;
  followers: ProfileCardDetail[];
  requests: FollowRequestDetail[];
}

@Singleton()
export class SettingsController {
  constructor(
    private readonly instanceConfigStore: InstanceConfigStore,
    private readonly personaStore: PersonaStore,
    private readonly localPostStore: LocalPostStore,
    private readonly localAttachmentStore: LocalAttachmentStore,
    private readonly inFollowStore: InFollowStore,
    private readonly remoteProfileStore: RemoteProfileStore,
  ) {}

  async #userDetail(): Promise<UserDetail> {
    const instanceConfig = await this.instanceConfigStore.get();
    return {
      serverName: instanceConfig.displayName,
      personas: await chainFrom(this.personaStore.list()).map((p) => ({
        name: p.name,
        displayName: p.displayName ?? p.name,
      })).toArray(),
    };
  }

  async #followDetail(inFollow: InFollow): Promise<FollowRequestDetail> {
    let profile;
    try {
      profile = await this.remoteProfileStore.get(inFollow.remoteProfile);
    } catch {
      profile = {
        name: inFollow.remoteProfile.path,
        type: ProfileType.Person,
      };
    }
    return {
      addr: inFollow.remoteProfile,
      type: profile.type,
      url: profile.url ?? undefined,
      name: profile.name,
      displayName: profile.displayName ?? profile.name,
      followRequestId: inFollow.id,
    };
  }

  async settingsRoot(): Promise<{ user: UserDetail }> {
    return { user: await this.#userDetail() };
  }

  async personasForm(): Promise<{ user: UserDetail; personas: Persona[] }> {
    return {
      user: await this.#userDetail(),
      personas: await chainFrom(this.personaStore.list()).toArray(),
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
      persona: await this.personaStore.get(personaName),
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
        followers: await chainFrom(
          this.inFollowStore.listFollowers(persona.name),
        ).mapAsync((f) => this.#followDetail(f)).toArray(),
        requests: await chainFrom(
          this.inFollowStore.listRequests(persona.name),
        ).mapAsync((f) => this.#followDetail(f)).toArray(),
      });
    }
    return { user: await this.#userDetail(), followersByPersona };
  }

  async doAcceptFollow(id: number): Promise<void> {
    await this.inFollowStore.accept({ id });
  }

  async doRejectFollow(id: number): Promise<void> {
    await this.inFollowStore.reject({ id });
  }

  async composeForm(): Promise<{ user: UserDetail; personas: Persona[] }> {
    return {
      user: await this.#userDetail(),
      personas: await chainFrom(this.personaStore.list()).toArray(),
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
