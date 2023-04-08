import {
  blurhashEncode,
  ImageMagick,
  IMagickImage,
  MagickFormat,
} from "$/deps.ts";
import { InjectableAbstract, Singleton } from "$/lib/inject.ts";
import { LocalMediaStore } from "$/models/LocalMedia.ts";
import { LocalDatabaseService } from "$/services/LocalDatabaseService.ts";
import { UlidService } from "$/services/UlidService.ts";

export enum AttachmentType {
  Download = 0,
  Image = 1,
  Audio = 2,
  Video = 3,
}

export interface LocalAttachment {
  readonly id: string;
  readonly type: AttachmentType;
  readonly postId: string;
  readonly original: string;
  readonly small?: string | null;
  readonly blurhash?: string | null;
  readonly alt?: string | null;
}

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

@InjectableAbstract()
export abstract class LocalAttachmentStore {
  abstract list(postId?: string): AsyncIterable<LocalAttachment>;

  abstract count(postId?: string): Promise<number>;

  abstract get(id: string): Promise<LocalAttachment | null>;

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

  async get(id: string): Promise<LocalAttachment | null> {
    for await (
      const row of this.db.get("attachment", { where: { id }, limit: 1 })
    ) {
      return row;
    }
    return null;
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

  #shrinkImage(image: IMagickImage, maxWidth: number) {
    if (image.width > maxWidth) {
      image.resize(maxWidth, ((image.height / image.width) * maxWidth) | 0);
    }
  }

  #formatToMimetype(format: MagickFormat): string {
    switch (format) {
      case MagickFormat.Gif:
        return "image/gif";
      case MagickFormat.Png:
        return "image/png";
      case MagickFormat.Jpg:
      case MagickFormat.Jpeg:
        return "image/jpeg";
      case MagickFormat.Tiff:
        return "image/tiff";
      case MagickFormat.Webp:
        return "image/webp";
      default:
        throw new TypeError(
          `Cannot determine mimetype of image format ${JSON.stringify(format)}`,
        );
    }
  }

  async createImage(options: CreateImageOptions): Promise<LocalAttachment> {
    const id = this.ulid.next(),
      original = await ImageMagick.read(options.data, (img) => {
        if (options.compress) this.#shrinkImage(img, 1024);
        const data = options.compress
          ? img.write((data) => data, MagickFormat.Webp)
          : options.data;
        return this.media.create(
          data,
          options.compress
            ? "image/webp"
            : (options.mimetype ?? this.#formatToMimetype(img.format)),
          { width: img.width, height: img.height },
        );
      }),
      { small, blurhash } = await ImageMagick.read(
        options.data,
        async (img) => {
          this.#shrinkImage(img, 512);
          const small = await img.write(
            (data) =>
              this.media.create(data, "image/webp", {
                width: img.width,
                height: img.height,
              }),
            MagickFormat.Webp,
          );
          this.#shrinkImage(img, 64);
          return {
            small,
            // TODO: pick componentX/componentY with an actual algorithm
            blurhash: img.write((x) =>
              blurhashEncode(
                new Uint8ClampedArray(x),
                img.width,
                img.height,
                4,
                3,
              ), MagickFormat.Rgba),
          };
        },
      ),
      attachment = {
        id,
        type: AttachmentType.Image,
        postId: options.postId,
        alt: options.alt,
        original,
        small,
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
