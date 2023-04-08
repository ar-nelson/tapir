import { Singleton } from "$/lib/inject.ts";
import { publicKeyToPem } from "$/lib/signatures.ts";
import * as urls from "$/lib/urls.ts";
import { Persona } from "$/models/PersonaStoreReadOnly.ts";
import { TapirConfig } from "$/models/TapirConfig.ts";
import {
  Activity,
  Actor,
  Collection,
  CollectionPage,
  key,
  Link,
  LinkRefs,
  Object,
} from "$/schemas/activitypub/mod.ts";

@Singleton()
export class ActivityPubGeneratorService {
  constructor(private readonly config: TapirConfig) {}

  getOneLink(link: null | undefined | LinkRefs): string | undefined {
    if (!link) return undefined;
    else if (Array.isArray(link)) return this.getOneLink(link[0]);
    else if (typeof link === "string") return link;
    else return (link as Link).href;
  }

  publicActivity(
    persona: string,
    props: {
      type: Activity["type"];
      createdAt?: Date;
      object?: Object | string;
      target?: Object | string;
    },
  ): Omit<Activity, "id"> {
    return {
      type: props.type,
      actor: urls.activityPubActor(persona, this.config.url),
      to: key.Public,
      cc: urls.activityPubFollowers(persona, this.config.url),
      published: (props.createdAt ?? new Date()).toJSON(),
      ...props.object ? { object: props.object } : {},
      ...props.target ? { target: props.target } : {},
    };
  }

  directActivity(
    persona: string,
    receivers: string | string[],
    props: {
      type: Activity["type"];
      createdAt?: Date;
      object?: Object | string;
      target?: Object | string;
    },
  ): Omit<Activity, "id"> {
    return {
      type: props.type,
      actor: urls.activityPubActor(persona, this.config.url),
      to: receivers,
      published: (props.createdAt ?? new Date()).toJSON(),
      ...props.object ? { object: props.object } : {},
      ...props.target ? { target: props.target } : {},
    };
  }

  async actor(persona: Persona, publicKey?: CryptoKey): Promise<Actor> {
    return {
      id: urls.activityPubActor(persona.name, this.config.url),
      type: "Person",

      name: persona.displayName,
      preferredUsername: persona.name,
      url: urls.localProfile(persona.name, {}, this.config.url),
      summary: persona.summary,
      published: persona.createdAt.toJSON(),
      manuallyApprovesFollowers: persona.requestToFollow,
      discoverable: false,

      inbox: urls.activityPubInbox(persona.name, this.config.url),
      outbox: urls.activityPubOutbox(persona.name, this.config.url),
      followers: urls.activityPubFollowers(
        persona.name,
        this.config.url,
      ),
      following: urls.activityPubFollowing(
        persona.name,
        this.config.url,
      ),

      icon: {
        type: "Image",
        mediaType: "image/jpeg",
        url: urls.urlJoin(this.config.url, "tapir-avatar.jpg"),
      },

      publicKey: publicKey && {
        id: `${urls.activityPubActor(persona.name, this.config.url)}#main-key`,
        owner: urls.activityPubActor(persona.name, this.config.url),
        publicKeyPem: await publicKeyToPem(publicKey),
      },
    };
  }

  publicObject(
    persona: string,
    props: Partial<Object> & { readonly type: string },
  ): Object {
    return {
      attributedTo: urls.activityPubActor(persona, this.config.url),
      to: key.Public,
      cc: urls.activityPubFollowers(persona, this.config.url),
      ...props,
    };
  }

  attachment(props: {
    mimetype: string;
    hash: string;
    width?: number | null;
    height?: number | null;
    blurhash?: string | null;
    alt?: string | null;
  }): Object {
    return {
      type: "Document",
      mediaType: props.mimetype,
      url: urls.localMediaWithMimetype(
        props.hash,
        props.mimetype,
        this.config.url,
      ),
      ...props.width ? { width: props.width } : {},
      ...props.height ? { height: props.height } : {},
      ...props.blurhash ? { blurhash: props.blurhash } : {},
      ...props.alt ? { name: props.alt } : {},
    };
  }

  collection(id: string, entries: (string | Object)[]): Collection {
    return {
      id,
      type: "OrderedCollection",

      totalItems: entries.length,
      orderedItems: entries,
    };
  }

  collectionPage(id: string, entries: (string | Object)[]): CollectionPage {
    return {
      id,
      type: "OrderedCollectionPage",

      totalItems: entries.length,
      orderedItems: entries,
    };
  }
}
