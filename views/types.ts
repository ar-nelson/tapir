import { PostType } from "$/models/LocalPost.ts";
import { AttachmentType } from "$/models/LocalAttachment.ts";
import { View } from "$/lib/html.ts";

export interface ServerDetail {
  name: string;
  summary: View;
  links: { name: string; url: string }[];
}

export interface PostDetail {
  id: string;
  url: string;
  type: PostType;
  createdAt: Date;
  updatedAt?: Date;
  content?: View;
  collapseSummary?: string;
  replyTo?: string;
  author: FollowDetail;
  likes: number;
  boosts: number;
  replies: number;
  liked: boolean;
  boosted: boolean;
  attachments: AttachmentDetail[];
  previewCard?: PreviewCard;
}

export interface AttachmentDetail {
  url: string;
  blur?: string;
  type: AttachmentType;
  alt?: string;
}

export interface PreviewCard {
  url: string;
  title: string;
  summary: View;
  imageUrl?: string;
}

export interface FollowDetail {
  url: string;
  name: string;
  displayName: string;
  avatarUrl: string;
  avatarBlur?: string;
}

export interface FollowRequestDetail extends FollowDetail {
  id: string;
}

export interface ProfileDetail extends FollowDetail {
  summary: string;
  backgroundUrl?: string;
  backgroundBlur?: string;
  posts: number;
  followers: number;
  following: number;
  createdAt: Date;
}

export interface UserDetail {
  serverName: string;
  personas: { name: string; displayName: string }[];
}
