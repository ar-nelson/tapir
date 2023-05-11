import { Tag } from "$/lib/error.ts";
import { InjectableAbstract, Singleton } from "$/lib/inject.ts";
import { LocalMediaStore } from "$/models/LocalMedia.ts";
import { AttachmentType, LocalAttachment } from "$/models/types.ts";
import { LocalDatabaseService } from "$/services/LocalDatabaseService.ts";
import {
  Compress,
  MediaProcessorService,
} from "$/services/MediaProcessorService.ts";
import { UlidService } from "$/services/UlidService.ts";

export interface CreateDownloadOptions {
  postId: string;
  data: Uint8Array;
  mimetype: string;
  alt?: string;
}

export interface CreateImageOptions {
  postId: string;
  data: Uint8Array;
  compress?: boolean;
  mimetype?: string;
  alt?: string;
}

// No endpoints look up attachments directly,
// so Attachment Not Found is a 500, not a 404.
export const AttachmentNotFound = new Tag("Local Attachment Not Found");

@InjectableAbstract()
export abstract class LocalAttachmentStore {
  abstract list(postId?: string): AsyncIterable<LocalAttachment>;

  abstract count(postId?: string): Promise<number>;

  abstract get(id: string): Promise<LocalAttachment>;

  abstract createDownload(
    options: CreateDownloadOptions,
  ): Promise<LocalAttachment>;

  abstract createImage(options: CreateImageOptions): Promise<LocalAttachment>;

  abstract updateAlt(id: string, newAlt: string | null): Promise<void>;

  abstract delete(id: string): Promise<void>;

  abstract deleteForPost(postId: string): Promise<void>;
}

@Singleton(LocalAttachmentStore)
export class LocalAttachmentStoreImpl extends LocalAttachmentStore {
  constructor(
    private readonly db: LocalDatabaseService,
    private readonly media: LocalMediaStore,
    private readonly mediaProcessor: MediaProcessorService,
    private readonly ulid: UlidService,
  ) {
    super();
  }

  list(postId?: string): AsyncIterable<LocalAttachment> {
    return this.db.get("attachment", { where: postId ? { postId } : {} });
  }

  count(postId?: string): Promise<number> {
    return this.db.count("attachment", postId ? { postId } : {});
  }

  async get(id: string): Promise<LocalAttachment> {
    for await (
      const row of this.db.get("attachment", { where: { id }, limit: 1 })
    ) {
      return row;
    }
    throw AttachmentNotFound.error(`No attachment with ID ${id}`);
  }

  async createDownload(
    options: CreateDownloadOptions,
  ): Promise<LocalAttachment> {
    const media = await this.media.create(options.data, options.mimetype),
      id = this.ulid.next(),
      attachment = {
        id,
        type: AttachmentType.Download,
        original: media,
        postId: options.postId,
        alt: options.alt,
      };
    await this.db.insert("attachment", [attachment]);
    return attachment;
  }

  async createImage(options: CreateImageOptions): Promise<LocalAttachment> {
    const id = this.ulid.next(),
      { original, small, blurhash } = await this.mediaProcessor.importImage(
        options.data,
        {
          mimetype: options.mimetype,
          includeSmall: true,
          includeBlurhash: true,
          config: {
            compressImages: options.compress
              ? Compress.WhenNeeded
              : Compress.Never,
          },
        },
      ),
      originalHash = await this.media.create(
        original.data,
        original.mimetype,
        {
          width: original.width,
          height: original.height,
        },
      ),
      smallHash = small &&
        await this.media.create(small.data, small.mimetype, {
          width: small.width,
          height: small.height,
        }),
      attachment = {
        id,
        type: AttachmentType.Image,
        postId: options.postId,
        alt: options.alt,
        original: originalHash,
        small: smallHash,
        blurhash,
      };
    await this.db.insert("attachment", [attachment]);
    return attachment;
  }

  async updateAlt(id: string, newAlt: string | null): Promise<void> {
    await this.db.update("attachment", { id }, { alt: newAlt });
    // TODO: Update the associated LocalPost and publish
  }

  async delete(id: string): Promise<void> {
    // TODO: delete the media as well
    await this.db.delete("attachment", { id });
  }

  async deleteForPost(postId: string): Promise<void> {
    // TODO: delete the media as well
    await this.db.delete("attachment", { postId });
  }
}
