import { Tag } from "$/lib/error.ts";
import { InjectableAbstract, Injector, Singleton } from "$/lib/inject.ts";
import {
  InFollow,
  LocalAttachment,
  LocalPost,
  OutFollow,
  OutReaction,
  Persona,
  ProtoAddr,
} from "$/models/types.ts";

export const PublishFailed = new Tag("Publish Failed");

@InjectableAbstract()
export abstract class PublisherService {
  abstract publishPostHistory(
    personaName: string,
    to: ProtoAddr | URL,
  ): Promise<void>;
  abstract publishPost(postId: string, to: ProtoAddr | URL): Promise<void>;
  abstract createPost(
    post: LocalPost,
    attachments: readonly LocalAttachment[],
  ): Promise<void>;
  abstract updatePost(
    update: LocalPost & { readonly updatedAt: Date },
  ): Promise<void>;
  abstract deletePost(ulid: string): Promise<void>;
  abstract acceptInFollow(follow: Omit<InFollow, "id">): Promise<void>;
  abstract rejectInFollow(follow: Omit<InFollow, "id">): Promise<void>;
  abstract createOutFollow(follow: OutFollow): Promise<void>;
  abstract deleteOutFollow(follow: OutFollow): Promise<void>;
  abstract createReaction(reaction: OutReaction): Promise<void>;
  abstract deleteReaction(reaction: OutReaction): Promise<void>;
  abstract createPersona(persona: Persona): Promise<void>;
  abstract updatePersona(
    persona: Persona & { readonly updatedAt: Date },
  ): Promise<void>;
  abstract deletePersona(personaName: string): Promise<void>;
}

/** Proxy class with a dynamic import to break dependency cycle */
@Singleton(PublisherService)
export class ProxyPublisherService extends PublisherService {
  #proxy: Promise<PublisherService>;

  constructor(injector: Injector) {
    super();
    this.#proxy = import("$/services/PublisherServiceImpl.ts").then((
      { PublisherServiceImpl },
    ) => injector.resolve(PublisherServiceImpl));
  }

  async publishPostHistory(personaName: string, to: ProtoAddr | URL) {
    return (await this.#proxy).publishPostHistory(personaName, to);
  }
  async publishPost(postId: string, to: ProtoAddr | URL) {
    return (await this.#proxy).publishPost(postId, to);
  }
  async createPost(post: LocalPost, attachments: readonly LocalAttachment[]) {
    return (await this.#proxy).createPost(post, attachments);
  }
  async updatePost(update: LocalPost & { readonly updatedAt: Date }) {
    return (await this.#proxy).updatePost(update);
  }
  async deletePost(ulid: string) {
    return (await this.#proxy).deletePost(ulid);
  }
  async acceptInFollow(follow: InFollow) {
    return (await this.#proxy).acceptInFollow(follow);
  }
  async rejectInFollow(follow: InFollow) {
    return (await this.#proxy).rejectInFollow(follow);
  }
  async createOutFollow(follow: OutFollow) {
    return (await this.#proxy).createOutFollow(follow);
  }
  async deleteOutFollow(follow: OutFollow) {
    return (await this.#proxy).deleteOutFollow(follow);
  }
  async createReaction(reaction: OutReaction) {
    return (await this.#proxy).createReaction(reaction);
  }
  async deleteReaction(reaction: OutReaction) {
    return (await this.#proxy).deleteReaction(reaction);
  }
  async createPersona(persona: Persona) {
    return (await this.#proxy).createPersona(persona);
  }
  async updatePersona(persona: Persona & { readonly updatedAt: Date }) {
    return (await this.#proxy).updatePersona(persona);
  }
  async deletePersona(personaName: string) {
    return (await this.#proxy).deletePersona(personaName);
  }
}
