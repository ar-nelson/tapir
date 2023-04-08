import { Singleton } from "$/lib/inject.ts";
import { WebFingerResponse } from "$/schemas/webfinger/WebFingerResponse.ts";
import { TapirConfig } from "$/models/TapirConfig.ts";
import { PersonaStore } from "$/models/Persona.ts";
import * as urls from "$/lib/urls.ts";
import { log } from "$/deps.ts";

@Singleton()
export class WebFingerController {
  constructor(
    private readonly config: TapirConfig,
    private readonly personaStore: PersonaStore,
  ) {}

  async queryResource(
    resource: string,
  ): Promise<WebFingerResponse | undefined> {
    const match = /^acct:[@]?([^@:]+)(?:[@]([^@:]+))?$/i.exec(resource);
    if (!match || (match[2] && match[2] !== this.config.domain)) {
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
      subject: `acct:${name}@${this.config.domain}`,
      aliases: [
        urls.localProfile(name, {}, this.config.url),
        urls.activityPubActor(name, this.config.url),
      ],
      links: [
        {
          "rel": "http://webfinger.net/rel/profile-page",
          "type": "text/html",
          "href": urls.localProfile(name, {}, this.config.url),
        },
        {
          "rel": "self",
          "type": "application/activity+json",
          "href": urls.activityPubActor(name, this.config.url),
        },
      ],
    };
  }
}
