import { Singleton } from "$/lib/inject.ts";
import { WebFingerResponse } from "$/schemas/webfinger/WebFingerResponse.ts";
import { ServerConfigStore } from "$/models/ServerConfig.ts";
import { PersonaStore } from "$/models/Persona.ts";
import * as urls from "$/lib/urls.ts";
import { log } from "$/deps.ts";

@Singleton()
export class WebFingerController {
  constructor(
    private readonly serverConfigStore: ServerConfigStore,
    private readonly personaStore: PersonaStore,
  ) {}

  async queryResource(
    resource: string,
  ): Promise<WebFingerResponse | undefined> {
    const serverConfig = await this.serverConfigStore.getServerConfig(),
      match = /^acct:[@]?([^@:]+)(?:[@]([^@:]+))?$/i.exec(resource);
    if (!match || (match[2] && match[2] !== serverConfig.domain)) {
      log.warning(
        `not a valid acct resource for this server: ${
          JSON.stringify(resource)
        }`,
      );
      return undefined;
    }
    const name = match[1],
      persona = await this.personaStore.get(name);
    if (!persona) {
      log.warning(
        `cannot resolve resource ${
          JSON.stringify(resource)
        }: no persona named ${JSON.stringify(name)}`,
      );
      return undefined;
    }
    return {
      subject: `acct:${name}@${serverConfig.domain}`,
      aliases: [
        urls.localProfile(name, {}, serverConfig.url),
        urls.activityPubActor(name, serverConfig.url),
      ],
      links: [
        {
          "rel": "http://webfinger.net/rel/profile-page",
          "type": "text/html",
          "href": urls.localProfile(name, {}, serverConfig.url),
        },
        {
          "rel": "self",
          "type": "application/activity+json",
          "href": urls.activityPubActor(name, serverConfig.url),
        },
      ],
    };
  }
}
