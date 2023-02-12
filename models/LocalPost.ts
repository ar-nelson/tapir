import { InjectableAbstract, Singleton } from "$/lib/inject.ts";

export interface LocalPost {
  id: string;
  persona: string;
  createdAt: string;
  updatedAt?: string;
  content: string;
}

@InjectableAbstract()
export abstract class LocalPostStore {
  abstract listPosts(
    persona?: string,
    pageSize?: number,
    startAtId?: string,
  ): Promise<readonly LocalPost[]>;
  abstract getPost(id: string): Promise<LocalPost | null>;
}

const MOCK_POSTS: readonly LocalPost[] = [{
  id: "01GS1QE3YSC9H68R526RJMXNX4",
  persona: "tapir",
  createdAt: "2023-02-11T21:32:14-0500",
  updatedAt: "2023-02-12T08:52:15-0500",
  content:
    `Tapir Fact: Tapirs don't like to be followed. In fact, you could say they "reject all follow requests" because they "don't support that feature yet". Please don't take it personally.`,
}, {
  id: "01GS1P8RWDS2PX05WCJE0JCM15",
  persona: "tapir",
  createdAt: "2023-02-11T21:11:57-0500",
  updatedAt: "2023-02-12T08:52:15-0500",
  content: "oops, my timeline is backwards",
}, {
  id: "01GS1N303JEQJZ04471GDCMRYP",
  persona: "tapir",
  createdAt: "2023-02-11T20:51:23-0500",
  updatedAt: "2023-02-12T08:52:15-0500",
  content: "is this a xonk",
}, {
  id: "01GRQ0VY9N2VY42DTB4E2R9S9F",
  persona: "tapir",
  createdAt: "2023-02-07T17:44:52-0500",
  updatedAt: "2023-02-12T08:52:15-0500",
  content: "tapir has learned to communicate with activitypub",
}, {
  id: "01GRJCHG47RH0ZXC41MA9Y32HW",
  persona: "tapir",
  createdAt: "2023-02-05T22:33:19-0500",
  updatedAt: "2023-02-12T08:52:15-0500",
  content: "tapir has learned to communicate with elk",
}, {
  id: "01GREP1D6Z1DF4KQJ0XR8RQW2H",
  persona: "tapir",
  createdAt: "2023-02-04T12:02:13-0500",
  updatedAt: "2023-02-12T08:52:15-0500",
  content:
    `Tapir is based on Deno (<a rel="nofollow noopener noreferrer" href="https://fosstodon.org/@deno_land">@deno_land</a>) and the Fresh web framework. The goal is to be installable from a URL with a single command.`,
}, {
  id: "01GRCXZ3EP8A9XZXDAT5Z6JAG2",
  persona: "tapir",
  createdAt: "2023-02-03T19:42:26-0500",
  updatedAt: "2023-02-12T08:52:15-0500",
  content: "just setting up my tpir",
}];

@Singleton(LocalPostStore)
export class MockLocalPostStore extends LocalPostStore {
  async listPosts(persona?: string) {
    return (!persona || persona === "tapir") ? MOCK_POSTS : [];
  }
  async getPost(id: string) {
    return MOCK_POSTS.find((it) => it.id === id) ?? null;
  }
}
