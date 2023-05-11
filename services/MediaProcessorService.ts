import { blurhashEncode, Status } from "$/deps.ts";
import { Tag } from "$/lib/error.ts";
import { Singleton } from "$/lib/inject.ts";
import { InstanceConfigStore } from "$/models/InstanceConfig.ts";
import { MediaNotFound } from "$/models/LocalMedia.ts";
import { ProtoAddr } from "$/models/types.ts";
import { HttpDispatcher, Priority } from "$/services/HttpDispatcher.ts";

import {
  ImageMagick,
  IMagickImage,
  initializeImageMagick,
  MagickFormat,
} from "imagemagick";

export enum Compress {
  Never,
  WhenNeeded,
  Always,
}

export interface MediaConfig {
  maxMediaBytes: number;
  maxImageBytes: number;
  maxImagePixels: number;
  maxVideoBytes: number;
  maxVideoPixels: number;
  maxVideoFramerate: number;
  compressImages: Compress;
  smallMaxBytes: number;
  smallMaxPixels: number;
}

export interface Media {
  data: Uint8Array;
  width?: number;
  height?: number;
  mimetype: string;
}

export const UnsupportedMediaType = new Tag("Unsupported Media Type", {
  internal: false,
  httpStatus: Status.UnsupportedMediaType,
});

@Singleton()
export class MediaProcessorService {
  #init = initializeImageMagick();

  constructor(
    private readonly instanceConfigStore: InstanceConfigStore,
    private readonly httpDispatcher: HttpDispatcher,
  ) {}

  async #defaultConfig(): Promise<MediaConfig> {
    const {
      maxImageBytes,
      maxImagePixels,
      maxVideoBytes,
      maxVideoPixels,
      maxVideoFramerate,
    } = await this.instanceConfigStore.get();
    return {
      maxMediaBytes: Math.max(maxImageBytes, maxVideoBytes),
      maxImageBytes,
      maxImagePixels,
      maxVideoBytes,
      maxVideoPixels,
      maxVideoFramerate,
      compressImages: Compress.WhenNeeded,
      smallMaxBytes: 1024 * 1024,
      smallMaxPixels: 512 * 512,
    };
  }

  async fetchMedia(url: URL, opts: {
    mimetype?: string;
    owner?: ProtoAddr;
    includeSmall?: boolean;
    priority?: Priority;
    config?: Partial<MediaConfig>;
  } = {}): Promise<{ original: Media; small?: Media }> {
    const config = { ...await this.#defaultConfig(), ...opts.config ?? {} },
      response = await this.httpDispatcher.dispatchAndWait(
        new Request(
          url,
          opts.mimetype ? { headers: { accept: opts.mimetype } } : {},
        ),
        {
          priority: opts.priority ?? Priority.Immediate,
          overrideTrust: false, // TODO: Check owner with ProfileTrust
          maxBytes: config.maxMediaBytes,
          throwOnError: MediaNotFound,
        },
      ),
      mimetype = response.headers.get("content-type") ?? opts.mimetype,
      data = new Uint8Array(await response.arrayBuffer());
    if (mimetype?.startsWith("image/")) {
      return this.importImage(data, {
        mimetype,
        config,
        includeSmall: opts.includeSmall,
      });
    } else {
      return {
        original: { data, mimetype: mimetype ?? "application/octet-stream" },
      };
    }
  }

  #shrinkImage(image: IMagickImage, maxPixels: number) {
    if (image.width * image.height > maxPixels) {
      const newWidth = (maxPixels / image.height) | 0;
      image.resize(newWidth, ((image.height / image.width) * newWidth) | 0);
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
        throw UnsupportedMediaType.error(
          `Cannot determine mimetype of image format ${JSON.stringify(format)}`,
        );
    }
  }

  async importImage(bytes: Uint8Array, opts: {
    mimetype?: string;
    includeSmall?: boolean;
    includeBlurhash?: boolean;
    config?: Partial<MediaConfig>;
  } = {}): Promise<{ original: Media; small?: Media; blurhash?: string }> {
    await this.#init;
    const config = { ...await this.#defaultConfig(), ...opts.config ?? {} },
      original = ImageMagick.read(bytes, (img) => {
        let compressed = false;
        if (
          config.compressImages === Compress.Always ||
          (config.compressImages === Compress.WhenNeeded &&
            (bytes.byteLength > config.maxImageBytes ||
              img.width * img.height > config.maxImagePixels))
        ) {
          compressed = true;
          this.#shrinkImage(img, config.maxImagePixels);
        }
        const data = compressed
          ? img.write((data) => data, MagickFormat.Webp)
          : bytes;
        return {
          data,
          mimetype: compressed
            ? "image/webp"
            : (opts.mimetype ?? this.#formatToMimetype(img.format)),
          width: img.width,
          height: img.height,
        };
      });
    if (opts.includeSmall || opts.includeBlurhash) {
      const { small, blurhash } = ImageMagick.read(
        bytes,
        (img) => {
          let small: Media | undefined, blurhash: string | undefined;
          if (opts.includeSmall) {
            this.#shrinkImage(img, config.smallMaxPixels);
            small = {
              data: img.write((data) => data, MagickFormat.Webp),
              mimetype: "image/webp",
              width: img.width,
              height: img.height,
            };
          }
          if (opts.includeBlurhash) {
            this.#shrinkImage(img, 64 * 64);
            // TODO: pick componentX/componentY with an actual algorithm
            blurhash = img.write((x) =>
              blurhashEncode(
                new Uint8ClampedArray(x),
                img.width,
                img.height,
                4,
                3,
              ), MagickFormat.Rgba);
          }
          return { small, blurhash };
        },
      );
      return { original, small, blurhash };
    }
    return { original };
  }
}
