import { Singleton } from "$/lib/inject.ts";
import { LocalMediaStore } from "$/models/LocalMedia.ts";
import * as urls from "$/lib/urls.ts";

export class AbstractMediaController {
  constructor(
    private readonly lookupMedia: (
      hash: string,
    ) => Promise<
      { readonly data: Uint8Array; readonly mimetype: string } | null
    >,
  ) {}

  async getMedia(filename: string): Promise<Response> {
    const split = filename.split(".");
    let mimetype: string | undefined = undefined;
    if (split.length === 2) {
      mimetype = urls.extensionToMimetype(`.${split[1]}`);
      if (!mimetype) {
        return new Response(`no known mimetype for extension: .${split[1]}`, {
          status: 404,
        });
      }
    } else if (split.length > 2) {
      return new Response("not a valid media URL", { status: 404 });
    }
    const media = await this.lookupMedia(split[0]);
    if (!media) {
      return new Response("media not found", { status: 404 });
    }
    return new Response(media.data, {
      headers: {
        "content-type": mimetype ?? media.mimetype,
        "cache-control": "public, max-age=604800, immutable",
      },
    });
  }
}

@Singleton()
export class LocalMediaController extends AbstractMediaController {
  constructor(localMediaStore: LocalMediaStore) {
    super(localMediaStore.get.bind(localMediaStore));
  }
}
