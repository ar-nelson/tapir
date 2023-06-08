import { Singleton } from "$/lib/inject.ts";
import { PostNotFound, RemotePostStore } from "$/models/RemotePost.ts";
import {
  ProtoAddr,
  protoAddrToString,
  Protocol,
  RemotePostFull,
} from "$/models/types.ts";
import { LocalFetcher } from "$/services/RemoteFetcherService.ts";
import { REMOTE_POSTS } from "./mock-data.ts";

@Singleton()
export class MockRemotePostStore extends RemotePostStore {
  constructor(private readonly localFetcher: LocalFetcher) {
    super();
  }

  get(addr: ProtoAddr): Promise<RemotePostFull> {
    if (addr.protocol === Protocol.Local) {
      return this.localFetcher.fetchPost(addr.path);
    }
    const addrString = protoAddrToString(addr),
      post = Object.values(REMOTE_POSTS).flat().find((p) =>
        protoAddrToString(p.addr) === addrString
      );
    return post ? Promise.resolve(post) : Promise.reject(
      PostNotFound.error(`No mock post at addr ${addrString}`),
    );
  }

  upsert(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  update(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  delete(): Promise<void> {
    throw new Error("Method not implemented.");
  }
}
