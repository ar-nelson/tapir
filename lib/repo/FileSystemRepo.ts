import { Repo } from "./Repo.ts";
import { RepoFactory } from "./RepoFactory.ts";
import { Singleton } from "$/lib/inject.ts";
import { BlobHashService } from "$/services/BlobHashService.ts";
import { dirExistsSync, fileExists } from "$/lib/utils.ts";
import { log, path } from "$/deps.ts";

export abstract class FileSystemRepo implements Repo {
  constructor(
    private readonly hash: BlobHashService,
    private readonly path: string,
    overwrite = false,
  ) {
    if (dirExistsSync(path)) {
      if (overwrite) {
        log.warning(
          `Repo directory ${
            JSON.stringify(path)
          } already exists and overwrite=true; deleting!`,
        );
        Deno.removeSync(path, { recursive: true });
        Deno.mkdirSync(path);
      }
    } else {
      log.info(`Creating new repo directory at ${JSON.stringify(path)}`);
      Deno.mkdirSync(path);
    }
  }

  async get(hash: string): Promise<Uint8Array | null> {
    if (!this.hash.isHash(hash)) {
      throw new TypeError(
        `${JSON.stringify(hash)} is not a valid media repo hash`,
      );
    }
    try {
      const file = await Deno.readFile(path.join(this.path, hash));
      return file;
    } catch (e) {
      if (e instanceof Deno.errors.NotFound) {
        return null;
      }
      throw e;
    }
  }

  has(hash: string): Promise<boolean> {
    return fileExists(path.join(this.path, hash));
  }

  async put(data: Uint8Array): Promise<string> {
    const hash = await this.hash.hash(data);
    await Deno.writeFile(path.join(this.path, hash), data);
    return hash;
  }

  async delete(hash: string): Promise<void> {
    try {
      await Deno.remove(path.join(this.path, hash));
    } catch (e) {
      if (e instanceof Deno.errors.NotFound) {
        log.warning(
          `Cannot delete media repo entry ${
            JSON.stringify(hash)
          }: entry does not exist`,
        );
      } else {
        throw e;
      }
    }
  }

  async clear(): Promise<void> {
    for await (const entry of Deno.readDir(this.path)) {
      if (entry.isFile && this.hash.isHash(entry.name)) {
        await Deno.remove(path.join(this.path, entry.name));
      }
    }
  }

  async *[Symbol.asyncIterator](): AsyncIterator<string> {
    for await (const entry of Deno.readDir(this.path)) {
      if (entry.isFile && this.hash.isHash(entry.name)) {
        yield entry.name;
      }
    }
  }
}

export class FileSystemRepoFactory extends RepoFactory {
  constructor(
    private readonly path: string,
    private readonly overwrite = false,
  ) {
    super();
  }

  protected construct() {
    const { path, overwrite } = this;

    @Singleton()
    class FileSystemRepoImpl extends FileSystemRepo {
      constructor(hash: BlobHashService) {
        super(hash, path, overwrite);
      }
    }

    return FileSystemRepoImpl;
  }
}
