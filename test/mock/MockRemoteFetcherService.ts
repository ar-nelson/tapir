import { Singleton } from "$/lib/inject.ts";
import { PostNotFound } from "$/models/RemotePost.ts";
import { ProfileNotFound } from "$/models/RemoteProfile.ts";
import {
  parseProtoAddr,
  Post,
  PostType,
  ProfileFeed,
  ProtoAddr,
  protoAddrToString,
  Protocol,
  RemotePostFull,
  RemoteProfile,
  RemoteProfileFull,
  RemoteReaction,
} from "$/models/types.ts";
import {
  FinitePageStream,
  LocalFetcher,
  PageStream,
  RemoteFetcherService,
} from "$/services/RemoteFetcherService.ts";
import {
  LOCAL_POSTS,
  MockRemoteProfile,
  REMOTE_FOLLOWS,
  REMOTE_POSTS,
  REMOTE_PROFILES,
} from "./mock-data.ts";

@Singleton()
export class MockRemoteFetcherService extends RemoteFetcherService {
  constructor(private readonly localFetcher: LocalFetcher) {
    super();
  }

  fetchProfile(addr: ProtoAddr): Promise<RemoteProfileFull> {
    if (addr.protocol === Protocol.Local) {
      return this.localFetcher.fetchProfile(addr.path);
    }
    const addrString = protoAddrToString(addr),
      profile = (REMOTE_PROFILES as Record<string, RemoteProfile>)[addrString];
    return profile
      ? Promise.resolve({
        ...profile,
        proxies: [],
        publicKeys: [],
        tags: [],
        emoji: [],
      })
      : Promise.reject(
        ProfileNotFound.error(`No mock profile at addr ${addrString}`),
      );
  }

  fetchFollowers(profileAddr: ProtoAddr): Promise<FinitePageStream<ProtoAddr>> {
    if (profileAddr.protocol === Protocol.Local) {
      return this.localFetcher.fetchFollowers(profileAddr.path);
    }
    // TODO: Include OutFollows
    const addrString = protoAddrToString(profileAddr) as MockRemoteProfile,
      follows = Object.entries(REMOTE_FOLLOWS).filter(([, v]) =>
        v.includes(addrString)
      ).map((e) => parseProtoAddr(e[0]));
    return Promise.resolve(FinitePageStream.of(follows));
  }

  fetchFollowing(profileAddr: ProtoAddr): Promise<FinitePageStream<ProtoAddr>> {
    if (profileAddr.protocol === Protocol.Local) {
      return this.localFetcher.fetchFollowing(profileAddr.path);
    }
    const follows = (REMOTE_FOLLOWS as Record<string, readonly string[]>)[
      protoAddrToString(profileAddr)
    ] ?? [];
    return Promise.resolve(FinitePageStream.of(follows.map(parseProtoAddr)));
  }

  fetchProfileFeed(
    profileAddr: ProtoAddr,
    feed: ProfileFeed = ProfileFeed.Posts,
  ): Promise<PageStream<ProtoAddr | RemotePostFull>> {
    if (profileAddr.protocol === Protocol.Local) {
      return this.localFetcher.fetchProfileFeed(profileAddr.path, feed);
    }
    const addrString = protoAddrToString(profileAddr);
    let posts =
      (REMOTE_POSTS as Record<string, readonly RemotePostFull[]>)[addrString];
    if (!posts) {
      return Promise.reject(
        ProfileNotFound.error(`No mock profile at addr ${addrString}`),
      );
    }
    switch (feed) {
      case ProfileFeed.Posts:
        posts = posts.filter((p) => p.type !== PostType.Reply);
        break;
      case ProfileFeed.OwnPosts:
        posts = posts.filter((p) => p.type !== PostType.Boost);
        break;
      case ProfileFeed.Media:
        posts = posts.filter((p) => !!p.attachments.length);
        break;
    }
    return Promise.resolve(
      new FinitePageStream(
        () => Promise.resolve({ items: posts }),
        posts.length,
      ),
    );
  }

  fetchPost(addr: ProtoAddr): Promise<RemotePostFull> {
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

  fetchReplies(
    postAddr: ProtoAddr,
  ): Promise<FinitePageStream<ProtoAddr | RemotePostFull>> {
    if (postAddr.protocol === Protocol.Local) {
      return this.localFetcher.fetchReplies(postAddr.path);
    }
    const isReply = (p: Post) =>
        p.type === PostType.Reply &&
        p.targetPost!.protocol === postAddr.protocol &&
        p.targetPost!.path === postAddr.path,
      replies = [
        ...Object.values(LOCAL_POSTS).flat().filter(isReply).map((p) => ({
          protocol: Protocol.Local,
          path: p.id,
        })),
        ...Object.values(REMOTE_POSTS).flat().filter(isReply),
      ];
    return Promise.resolve(
      new FinitePageStream(
        () => Promise.resolve({ items: replies }),
        replies.length,
      ),
    );
  }

  fetchReactions(
    postAddr: ProtoAddr,
  ): Promise<FinitePageStream<RemoteReaction>> {
    if (postAddr.protocol === Protocol.Local) {
      return this.localFetcher.fetchReactions(postAddr.path);
    }
    // TODO: Reactions
    return Promise.resolve(FinitePageStream.empty());
  }

  fetchBoosts(
    postAddr: ProtoAddr,
  ): Promise<FinitePageStream<ProtoAddr | RemotePostFull>> {
    if (postAddr.protocol === Protocol.Local) {
      return this.localFetcher.fetchBoosts(postAddr.path);
    }
    const isBoost = (p: Post) =>
        p.type === PostType.Boost &&
        p.targetPost!.protocol === postAddr.protocol &&
        p.targetPost!.path === postAddr.path,
      boosts = [
        ...Object.values(LOCAL_POSTS).flat().filter(isBoost).map((p) => ({
          protocol: Protocol.Local,
          path: p.id,
        })),
        ...Object.values(REMOTE_POSTS).flat().filter(isBoost),
      ];
    return Promise.resolve(
      new FinitePageStream(
        () => Promise.resolve({ items: boosts }),
        boosts.length,
      ),
    );
  }

  fetchFeed(
    feedAddr: ProtoAddr,
  ): Promise<PageStream<ProtoAddr | RemotePostFull>> {
    if (feedAddr.protocol === Protocol.Local) {
      return this.localFetcher.fetchFeed(feedAddr.path);
    }
    throw new Error("Method not implemented.");
  }
}
