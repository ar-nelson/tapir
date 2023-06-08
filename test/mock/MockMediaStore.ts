import { Singleton } from "$/lib/inject.ts";
import {
  LocalMediaStore,
  MediaNotFound as LocalMediaNotFound,
} from "$/models/LocalMedia.ts";
import {
  MediaNotFound as RemoteMediaNotFound,
  RemoteMediaStore,
} from "$/models/RemoteMedia.ts";
import { Media, RemoteAttachment, RemoteMedia } from "$/models/types.ts";
import { MediaProcessorService } from "$/services/MediaProcessorService.ts";
import { LOCAL_MEDIA, REMOTE_MEDIA, unbase32ify } from "./mock-data.ts";

const MOCK_MEDIA_PATH = "test/mock/media/";

export class MockMediaLoader {
  readonly #cache = new Map<string, Promise<RemoteMedia>>();

  constructor(
    private readonly media: readonly Omit<RemoteMedia, "data" | "bytes">[],
    private readonly mediaProcessorService: MediaProcessorService,
  ) {}

  get(hash: string): Promise<Media | null> {
    const existing = this.#cache.get(hash);
    if (existing) return existing;
    const found = this.media.find((m) => m.hash === hash);
    if (!found) return Promise.resolve(null);
    const promise = (async (): Promise<Media> => {
      const data = await Deno.readFile(
          `${MOCK_MEDIA_PATH}${unbase32ify(hash)}`,
        ),
        processed = await this.#mediaProps(found.mimetype, data);
      return {
        ...found,
        ...processed,
        bytes: processed.data.byteLength,
      };
    })();
    this.#cache.set(hash, promise);
    return promise;
  }

  async #mediaProps(
    mimetype: string,
    data: Uint8Array,
  ): Promise<Partial<Media> & { data: Uint8Array }> {
    if (mimetype.startsWith("image/")) {
      return (await this.mediaProcessorService
        .importImage(data, { mimetype })).original;
    }
    return { data };
  }
}

@Singleton()
export class MockLocalMediaStore extends LocalMediaStore {
  readonly #loader: MockMediaLoader;

  constructor(mediaProcessorService: MediaProcessorService) {
    super();
    this.#loader = new MockMediaLoader(LOCAL_MEDIA, mediaProcessorService);
  }

  async *list(): AsyncIterable<string> {
    yield* LOCAL_MEDIA.map((m) => m.hash);
  }

  count(): Promise<number> {
    return Promise.resolve(LOCAL_MEDIA.length);
  }

  get(hash: string): Promise<Media> {
    return this.#loader.get(hash).then((m) => {
      if (m == null) {
        throw LocalMediaNotFound.error(`No mock media with hash ${hash}`);
      }
      return m;
    });
  }

  getMeta(hash: string): Promise<Omit<Media, "data">> {
    return this.get(hash).then(({ data, ...m }) => m);
  }

  create(): Promise<string> {
    throw new Error("Method not implemented.");
  }

  delete(): Promise<void> {
    throw new Error("Method not implemented.");
  }
}

@Singleton()
export class MockRemoteMediaStore extends RemoteMediaStore {
  readonly #loader: MockMediaLoader;

  constructor(mediaProcessorService: MediaProcessorService) {
    super();
    this.#loader = new MockMediaLoader(REMOTE_MEDIA, mediaProcessorService);
  }

  async *list(): AsyncIterable<string> {
    yield* REMOTE_MEDIA.map((m) => m.hash);
  }

  count(): Promise<number> {
    return Promise.resolve(REMOTE_MEDIA.length);
  }

  get(hash: string): Promise<RemoteMedia> {
    return this.#loader.get(hash).then((m) => {
      if (m == null) {
        throw RemoteMediaNotFound.error(`No mock media with hash ${hash}`);
      }
      return m;
    });
  }

  getMeta(hash: string): Promise<Omit<RemoteMedia, "data">> {
    return this.get(hash).then(({ data, ...m }) => m);
  }

  getByUrl(url: URL): Promise<RemoteMedia> {
    const matching = REMOTE_MEDIA.find((m) => m.url === url.href);
    if (!matching) {
      throw RemoteMediaNotFound.error(`No mock media at URL ${url}`);
    }
    return this.get(matching.hash);
  }

  getAttachmentOriginal(attachment: RemoteAttachment): Promise<RemoteMedia> {
    if (attachment.original) return this.get(attachment.original);
    return this.getByUrl(new URL(attachment.originalUrl));
  }

  create(): Promise<string> {
    throw new Error("Method not implemented.");
  }

  delete(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  purgeDomain(): Promise<void> {
    throw new Error("Method not implemented.");
  }
}
