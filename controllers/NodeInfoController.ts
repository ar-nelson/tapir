import { InjectableAbstract, Singleton } from "$/lib/inject.ts";
import { PersonaStore } from "$/models/Persona.ts";
import { LocalPostStore } from "$/models/LocalPost.ts";
import buildMeta from "$/resources/buildMeta.json" assert { type: "json" };
import * as urls from "$/lib/urls.ts";

export interface NodeInfoDirectory {
  links: {
    rel: string;
    href: string;
  }[];
}

export interface NodeInfoV2_0 {
  version: "2.0";
  software: {
    name: string;
    version: string;
  };
  protocols: string[];
  services: { outbound: string[]; inbound: string[] };
  usage: {
    users: {
      total: number;
      activeMonth: number;
      activeHalfyear: number;
    };
    localPosts: number;
  };
  openRegistrations: boolean;
  metadata: Record<string, unknown>;
}

@InjectableAbstract()
export abstract class NodeInfoController {
  nodeInfoDirectory(): NodeInfoDirectory {
    return {
      links: [{
        rel: "http://nodeinfo.diaspora.software/ns/schema/2.0",
        href: urls.nodeInfoV2_0,
      }],
    };
  }

  abstract nodeInfoV2_0(): Promise<NodeInfoV2_0>;
}

@Singleton(NodeInfoController)
export class NodeInfoControllerImpl extends NodeInfoController {
  constructor(
    private readonly personaStore: PersonaStore,
    private readonly localPostStore: LocalPostStore,
  ) {
    super();
  }

  async nodeInfoV2_0(): Promise<NodeInfoV2_0> {
    const userCount = await this.personaStore.count(),
      postCount = await this.localPostStore.count();
    return {
      version: "2.0",
      software: {
        name: buildMeta.name,
        version: buildMeta.version,
      },
      protocols: ["activitypub"],
      services: { outbound: [], inbound: [] },
      usage: {
        users: {
          total: userCount,
          activeMonth: userCount,
          activeHalfyear: userCount,
        },
        localPosts: postCount,
      },
      openRegistrations: false,
      metadata: {},
    };
  }
}
