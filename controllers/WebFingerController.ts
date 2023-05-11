import { Status } from "$/deps.ts";
import { LogLevels, Tag } from "$/lib/error.ts";
import { Singleton } from "$/lib/inject.ts";
import * as urls from "$/lib/urls.ts";
import { PersonaStore } from "$/models/Persona.ts";
import { TapirConfig } from "$/models/TapirConfig.ts";
import { WebFingerResponse } from "$/schemas/webfinger/WebFingerResponse.ts";

export const WebFingerNotFound = new Tag("WebFinger Resource Not Found", {
  level: LogLevels.WARNING,
  needsStackTrace: false,
  internal: false,
  httpStatus: Status.NotFound,
});

@Singleton()
export class WebFingerController {
  constructor(
    private readonly config: TapirConfig,
    private readonly personaStore: PersonaStore,
  ) {}

  async queryResource(
    resource: string,
  ): Promise<WebFingerResponse> {
    const match = /^acct:[@]?([^@:]+)(?:[@]([^@:]+))?$/i.exec(resource);
    if (!match || (match[2] && match[2] !== this.config.domain)) {
      throw WebFingerNotFound.error(
        `Not a valid acct resource for this server: ${
          JSON.stringify(resource)
        }`,
      );
    }
    const name = match[1],
      persona = await this.personaStore.get(name);
    if (!persona) {
      throw WebFingerNotFound.error(
        `Cannot resolve resource ${
          JSON.stringify(resource)
        }: No persona named ${JSON.stringify(name)}`,
      );
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
