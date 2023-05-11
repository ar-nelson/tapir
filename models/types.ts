export enum Protocol {
  Local = "local",
  ActivityPub = "ap",
  Mastodon = "toot",
}

export interface ProtoAddr {
  readonly protocol: Protocol;
  readonly path: string;
}

export function protoAddrToString({ protocol, path }: ProtoAddr): string {
  return `${protocol}$${path}`;
}

export function parseProtoAddr(addr: string): ProtoAddr {
  const separator = addr.indexOf("$");
  if (separator < 0) throw new TypeError(`Not a ProtoAddr: ${addr}`);
  return {
    protocol: addr.slice(0, separator) as Protocol,
    path: addr.slice(separator + 1),
  };
}

export enum KeyAlgorithm {
  RSA_SHA256 = 0,
  Ed25519 = 1,
  Secp256k1 = 2,
  TLSCert = 3,
}

export enum TrustLevel {
  BlockUnconditional = 0,
  BlockUnlessFollow = 1,
  Unset = 2,
  Trust = 3,
}

export interface TrustOptions {
  readonly requestToTrust: TrustLevel;
  readonly requestFromTrust: TrustLevel;
  readonly mediaTrust: TrustLevel;
  readonly feedTrust: TrustLevel;
  readonly replyTrust: TrustLevel;
  readonly dmTrust: TrustLevel;
}

export enum PostType {
  Note = 0,
  Reply = 1,
  Boost = 2,
  Poll = 3,
  Article = 4,
  Link = 5,
}

export enum ReactionType {
  Like = 0,
  Dislike = 1,
  Emoji = 2,
  Mention = 3,
  View = 4,
}

export enum TagType {
  Hashtag = 0,
  Mention = 1,
}

export enum AttachmentType {
  Download = 0,
  Image = 1,
  Audio = 2,
  Video = 3,
}

export enum DisplayStyle {
  Microblog = 0,
  Tumblelog = 1,
  Blog = 2,
  Gallery = 3,
  Pinboard = 4,
  Linkboard = 5,
  Channel = 6,
}

export enum ProfileType {
  Application = "application",
  Group = "group",
  Organization = "organization",
  Person = "person",
  Service = "service",
  Feed = "feed",
}

export enum ProfileFeed {
  Posts = "posts",
  OwnPosts = "own",
  PostsAndReplies = "replies",
  Media = "media",
}

export enum VisibilityType {
  Public = 0,
  Unlisted = 1,
  Followers = 2,
  List = 3,
  Direct = 4,
}

export type Visibility =
  | {
    type:
      | VisibilityType.Public
      | VisibilityType.Unlisted
      | VisibilityType.Followers;
  }
  | { type: VisibilityType.List; to: readonly string[] }
  | { type: VisibilityType.Direct; to: readonly ProtoAddr[] };

export interface Profile {
  readonly name: string;
  readonly type: ProfileType;
  readonly displayName?: string;
  readonly summary?: string;
  readonly requestToFollow?: boolean;
  readonly createdAt?: Date;
  readonly updatedAt?: Date;
}

export interface Post {
  readonly type: PostType;
  readonly createdAt: Date;
  readonly updatedAt?: Date;
  readonly content?: string;
}

export interface Attachment {
  readonly type: AttachmentType;
  readonly original?: string | null;
  readonly small?: string | null;
  readonly blurhash?: string | null;
  readonly alt?: string | null;
}

export interface Reaction {
  readonly type: ReactionType;
  readonly createdAt: Date;
  readonly content?: string | null;
}

export interface Follow {
  readonly persona: string;
  readonly remoteProfile: ProtoAddr;
  readonly createdAt: Date;
  readonly acceptedAt?: Date;
  readonly public: boolean;
}

export interface Persona extends Profile {
  readonly linkTitle?: string | null;
  readonly main: boolean;
  readonly createdAt: Date;
}

export interface LocalPost extends Post {
  readonly id: string;
  readonly persona: string;
  readonly collapseSummary?: string;
  readonly replyTo?: string;
}

export interface LocalAttachment extends Attachment {
  readonly id: string;
  readonly postId: string;
  readonly original: string;
}

export interface InFollow extends Follow {
  readonly id: number;
  readonly remoteActivity?: string;
}

export interface OutFollow extends Follow {
  readonly id: string;
}

export interface InReaction extends Reaction {
  readonly addr: ProtoAddr;
  readonly fromProfile: ProtoAddr;
  readonly localPost: string;
}

export interface OutReaction extends Reaction {
  readonly id: string;
  readonly persona: string;
  readonly remotePost: ProtoAddr;
}

export interface InBoost {
  readonly addr: ProtoAddr;
  readonly localPost: string;
  readonly remoteProfile: ProtoAddr;
  readonly createdAt: Date;
}

export interface RemoteProfile extends Profile {
  readonly addr: ProtoAddr;
  readonly instance?: string | null;
  readonly url?: string | null;
  readonly canonical: boolean;
  readonly profileMetadata?: unknown;
  readonly lastPostAt?: Date | null;
  readonly lastSeen: Date;
  readonly followingCount: number;
  readonly followerCount: number;
  readonly postCount: number;
  readonly apInbox?: string | null;
  readonly apSharedInbox?: string | null;
  readonly avatar?: string | null;
  readonly avatarBlurhash?: string | null;
  readonly avatarUrl?: string | null;
  readonly banner?: string | null;
  readonly bannerBlurhash?: string | null;
  readonly bannerUrl?: string | null;
}

export interface RemotePost extends Post {
  readonly addr: ProtoAddr;
  readonly profile: ProtoAddr;
  readonly instance?: string | null;
  readonly url?: string | null;
  readonly canonical: boolean;
  readonly viewedAt?: Date | null;
  readonly lang?: string | null;
  readonly targetPost?: ProtoAddr | null;
  readonly sensitive: boolean;
  readonly contentWarning?: string | null;
}

export interface RemoteReaction extends Reaction {
  readonly addr: ProtoAddr;
  readonly post: ProtoAddr;
  readonly profile: ProtoAddr;
}

export interface RemoteProxy {
  readonly original: ProtoAddr;
  readonly proxy: ProtoAddr;
  readonly canonical: boolean;
}

export const TAG_REGEX = /#?([^\s#@:`<>\\\[\]{}|]+)/;

export interface RemoteTag {
  readonly post: ProtoAddr;
  readonly tag: string;
  readonly inline: boolean;
  readonly url?: string | null;
}

export interface RemoteMention {
  readonly post: ProtoAddr;
  readonly profile: ProtoAddr;
}

export const EMOJI_SHORTCODE_REGEX = /:([^\s#@^&*:,;`'"<>/\\\[\]{}|]+):/;

export interface RemoteEmoji {
  readonly post?: ProtoAddr | null;
  readonly profile?: ProtoAddr | null;
  readonly shortcode: string;
  readonly url: string;
  readonly media?: string | null;
}

export interface RemoteAttachment extends Attachment {
  readonly post: ProtoAddr;
  readonly originalUrl: string;
  readonly smallUrl?: string | null;
  readonly sensitive: boolean;
}

export interface RemotePublicKey {
  readonly name: string;
  readonly owner: ProtoAddr;
  readonly algorithm: KeyAlgorithm;
  readonly key: Uint8Array;
}

export interface RemoteProfileFull extends RemoteProfile {
  readonly proxies: readonly Omit<RemoteProxy, "original">[];
  readonly publicKeys: readonly Omit<RemotePublicKey, "owner">[];
  readonly tags: readonly Omit<RemoteTag, "post">[];
  readonly emoji: readonly Omit<RemoteEmoji, "post" | "profile">[];
}

export interface RemotePostFull extends RemotePost {
  readonly proxies: readonly Omit<RemoteProxy, "original">[];
  readonly tags: readonly Omit<RemoteTag, "post">[];
  readonly mentions: readonly ProtoAddr[];
  readonly emoji: readonly Omit<RemoteEmoji, "post" | "profile">[];
  readonly attachments: readonly Omit<RemoteAttachment, "post">[];
}

export interface InstanceFeatures {
  readonly like?: boolean;
  readonly dislike?: boolean;
  readonly upDownVote?: boolean;
  readonly emojiReact?: boolean;
  readonly emojiLike?: boolean;
  readonly zap?: boolean;
  readonly boost?: boolean;
  readonly quotePost?: boolean;
  readonly reply?: boolean;
  readonly follow?: boolean;
  readonly chatMessage?: boolean;
  readonly rawMarkdown?: boolean;
  readonly backfill?: boolean;
}

export interface RemoteInstance {
  readonly url: string;
  readonly displayName?: string | null;
  readonly shortDescription?: string | null;
  readonly description?: string | null;
  readonly software?: string | null;
  readonly softwareVersion?: string | null;
  readonly instanceMetadata: Readonly<{
    protocols: Readonly<Partial<Record<Protocol, boolean>>>;
    features: InstanceFeatures;
    defaultStyle: DisplayStyle;
    rules?: readonly { readonly id: string; readonly text: string }[];
    stats?: { readonly users?: number; readonly posts?: number };
    links?: readonly { readonly name: string; readonly href: string }[];
    feeds?: readonly { readonly name: string; readonly addr: ProtoAddr }[];
    adminEmail?: string;
    admins?: readonly ProtoAddr[];
  }>;
  readonly logo?: string | null;
  readonly logoBlurhash?: string | null;
  readonly logoUrl?: string | null;
  readonly apSharedInbox?: string | null;
  readonly lastSeen: Date;
}
