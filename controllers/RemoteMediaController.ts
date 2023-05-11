import { AbstractMediaController } from "$/controllers/LocalMediaController.ts";
import { Context, Status } from "$/deps.ts";
import { Singleton } from "$/lib/inject.ts";
import * as urls from "$/lib/urls.ts";
import { RemoteMediaStore } from "$/models/RemoteMedia.ts";

@Singleton()
export class RemoteMediaController extends AbstractMediaController {
  constructor(private readonly remoteMediaStore: RemoteMediaStore) {
    super(remoteMediaStore.get.bind(remoteMediaStore));
  }

  async preload(ctx: Context, remoteUrl: string): Promise<void> {
    const media = await this.remoteMediaStore.getByUrl(new URL(remoteUrl));
    ctx.response.status = Status.MovedPermanently;
    ctx.response.redirect(
      urls.remoteMediaWithMimetype(media.hash, media.mimetype),
    );
  }
}
