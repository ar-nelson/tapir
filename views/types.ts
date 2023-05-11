import { DateTime } from "$/lib/datetime/mod.ts";
import { View } from "$/lib/html.ts";
import {
  AttachmentType,
  InstanceFeatures,
  PostType,
  ProfileType,
  ProtoAddr,
  Protocol,
} from "$/models/types.ts";

export interface ServerDetail {
  name: string;
  summary: View;
  links: { name: string; url: string }[];
}

export interface UserDetail {
  serverName: string;
  personas: { name: string; displayName: string }[];
}

export interface InstanceDetail {
  url: URL;
  protocols: Partial<Record<Protocol, boolean>>;
  displayName?: string;
  shortDescription?: string;
  description?: string;
  logoUrl?: string;
  software?: string;
  softwareVersion?: string;
  adminEmail?: string;
  rules?: readonly { id: string; text: string }[];
  links?: readonly { name: string; href: string }[];
  stats: {
    users?: number;
    posts?: number;
  };
  feeds: readonly { name: string; addr: ProtoAddr }[];
  admins: readonly ProfileCardDetail[];
  features: InstanceFeatures;
}

export interface ProfileCardDetail {
  addr: ProtoAddr;
  proxies?: readonly { proxy: ProtoAddr; canonical?: boolean }[];
  canonical?: boolean;
  name: string;
  displayName?: string;
  type: ProfileType;
  url?: string;
  instance?: string;
  you?: boolean;
  followedByYou?: boolean;
  followsYou?: boolean;
  muted?: boolean;
  blocked?: boolean;
  followable?: boolean;
  requestToFollow?: boolean;
  avatarUrl?: string;
  avatarBlur?: string;
}

export interface ProfileDetail extends ProfileCardDetail {
  createdAt?: DateTime;
  updatedAt?: DateTime;
  postCount?: number;
  followingCount?: number;
  followerCount?: number;
  summary?: string;
  bannerUrl?: string;
  bannerBlur?: string;
  fields?: { name: string; value: string; verifiedAt?: DateTime }[];
}

export interface PostDetail {
  addr: ProtoAddr;
  proxies?: readonly { proxy: ProtoAddr; canonical?: boolean }[];
  canonical?: boolean;
  author: ProfileCardDetail;
  url?: string;
  type: PostType;
  createdAt: DateTime;
  updatedAt?: DateTime;
  content?: string;
  contentWarning?: string;
  filterReason?: string;
  replyTo?: ProtoAddr;
  boost?: PostDetail;
  tags?: readonly { tag: string; url?: string | null; inline?: boolean }[];
  mentions?: readonly ProtoAddr[];
  attachments?: AttachmentDetail[];
  previewCards?: PreviewCard[];
  actions: {
    like?: {
      enabled: boolean;
      you?: boolean;
      count?: number;
    };
    upDownVote?: {
      enabled: boolean;
      you?: -1 | 0 | 1;
      count?: number;
    };
    emojiReact?: {
      enabled: boolean;
      you?: string;
      count?: number;
      counts?: { emoji: string; count?: number }[];
    };
    zap?: {
      enabled: boolean;
      you?: boolean;
      count?: number;
    };
    boost?: {
      enabled: boolean;
      you?: boolean;
      count?: number;
    };
    reply?: {
      enabled: boolean;
      count?: number;
    };
    bookmark?: {
      you?: boolean;
    };
    poll?: {
      enabled: boolean;
      items: { name: string; votes: number }[];
      you?: number | number[];
      multi?: boolean;
      totalVotes?: number;
      ends?: DateTime;
    };
  };
}

export interface AttachmentDetail {
  url: string;
  smallUrl?: string;
  blur?: string;
  type: AttachmentType;
  mimetype?: string;
  alt?: string;
  sensitive?: boolean;
}

export interface PreviewCard {
  url: string;
  title: string;
  summary: View;
  imageUrl?: string;
}

export interface FollowRequestDetail extends ProfileCardDetail {
  followRequestId: number;
}

export interface ReactionDetail {
  createdAt: DateTime;
  emoji?: string;
  author: ProfileCardDetail;
}
