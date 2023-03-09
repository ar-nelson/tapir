import { Context, Status } from "$/deps.ts";
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

  async getMedia(ctx: Context, filename: string): Promise<void> {
    const split = filename.split(".");
    let mimetype: string | undefined = undefined;
    if (split.length === 2) {
      mimetype = urls.extensionToMimetype(`.${split[1]}`);
      ctx.assert(
        mimetype,
        Status.NotFound,
        `No known mimetype for extension: .${split[1]}`,
      );
    } else {
      ctx.assert(split.length === 1, Status.NotFound, "Not a valid media URL");
    }
    const media = await this.lookupMedia(split[0]);
    ctx.assert(media, Status.NotFound, "Media not found");
    ctx.response.headers.set("content-type", mimetype ?? media.mimetype);
    ctx.response.headers.set(
      "cache-control",
      "public, max-age=604800, immutable",
    );
    ctx.response.body = media.data;
  }
}

@Singleton()
export class LocalMediaController extends AbstractMediaController {
  constructor(localMediaStore: LocalMediaStore) {
    super(localMediaStore.get.bind(localMediaStore));
  }
}
