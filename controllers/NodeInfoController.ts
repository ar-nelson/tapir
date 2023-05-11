import { InjectableAbstract, Singleton } from "$/lib/inject.ts";
import * as urls from "$/lib/urls.ts";
import { LocalPostStore } from "$/models/LocalPost.ts";
import { PersonaStore } from "$/models/Persona.ts";
import buildMeta from "$/resources/buildMeta.json" assert { type: "json" };
import { NodeInfoDirectory, NodeInfoV2 } from "$/schemas/nodeinfo/mod.ts";
import { TapirConfig } from "../models/TapirConfig.ts";

@InjectableAbstract()
export abstract class NodeInfoController {
  abstract nodeInfoDirectory(): NodeInfoDirectory;

  abstract nodeInfoV2_1(): Promise<NodeInfoV2>;

  async nodeInfoV2_0(): Promise<NodeInfoV2> {
    const { version: _, software: { name, version }, ...v21 } = await this
      .nodeInfoV2_1();
    return {
      version: "2.0",
      software: { name, version },
      ...v21,
    };
  }
}

@Singleton(NodeInfoController)
export class NodeInfoControllerImpl extends NodeInfoController {
  constructor(
    private readonly config: TapirConfig,
    private readonly personaStore: PersonaStore,
    private readonly localPostStore: LocalPostStore,
  ) {
    super();
  }

  nodeInfoDirectory(): NodeInfoDirectory {
    return {
      links: [{
        rel: "http://nodeinfo.diaspora.software/ns/schema/2.1",
        href: urls.urlJoin(this.config.url, urls.nodeInfoV2_1),
      }, {
        rel: "http://nodeinfo.diaspora.software/ns/schema/2.0",
        href: urls.urlJoin(this.config.url, urls.nodeInfoV2_0),
      }],
    };
  }

  async nodeInfoV2_1(): Promise<NodeInfoV2> {
    const userCount = await this.personaStore.count(),
      postCount = await this.localPostStore.count();
    return {
      version: "2.1",
      software: {
        name: buildMeta.name,
        version: buildMeta.version,
        homepage: buildMeta.homepageUrl,
        repository: buildMeta.githubUrl,
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
