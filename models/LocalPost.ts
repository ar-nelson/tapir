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
  id: "01GS3EACBSFYB8C1FMHTSEWJZY",
  persona: "tapir",
  createdAt: "2023-02-11T21:32:14-0500",
  updatedAt: "2023-02-12T08:52:15-0500",
  content:
    `Tapir Fact: Tapirs don't like to be followed. In fact, you could say they "reject all follow requests" because they "don't support that feature yet". Please don't take it personally.`,
}, {
  id: "01GS3E7MSAE3C7E68YGED07CF7",
  persona: "tapir",
  createdAt: "2023-02-11T21:11:57-0500",
  updatedAt: "2023-02-12T08:52:15-0500",
  content: "oops, my timeline is backwards",
}, {
  id: "01GS3E7MAH1NMKRRMT1GKZ28GK",
  persona: "tapir",
  createdAt: "2023-02-11T20:51:23-0500",
  updatedAt: "2023-02-12T08:52:15-0500",
  content: "is this a xonk",
}, {
  id: "01GS3E7KVNSK7CS4HDAFA2P2GS",
  persona: "tapir",
  createdAt: "2023-02-07T17:44:52-0500",
  updatedAt: "2023-02-12T08:52:15-0500",
  content: "tapir has learned to communicate with activitypub",
}, {
  id: "01GS3E7KAKEBBKSK424XCSQPHV",
  persona: "tapir",
  createdAt: "2023-02-05T22:33:19-0500",
  updatedAt: "2023-02-12T08:52:15-0500",
  content: "tapir has learned to communicate with elk",
}, {
  id: "01GS3E7JB1FCC03SKGHJ3V294A",
  persona: "tapir",
  createdAt: "2023-02-04T12:02:13-0500",
  updatedAt: "2023-02-12T08:52:15-0500",
  content:
    `Tapir is based on Deno (<a rel="nofollow noopener noreferrer" href="https://fosstodon.org/@deno_land">@deno_land</a>) and the Fresh web framework. The goal is to be installable from a URL with a single command.`,
}, {
  id: "01GS3E7HHDRQRPN8YVEPK091SF",
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
