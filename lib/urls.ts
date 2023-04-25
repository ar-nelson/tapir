import { isPersonaName } from "$/lib/utils.ts";

const extensionByMimetype: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/gif": ".gif",
  "image/tiff": ".tiff",
  "image/svg+xml": ".svg",
  "image/webp": ".webp",

  "audio/x-wav": ".wav",
  "audio/x-mp3": ".mp3",
  "audio/mpeg": ".mp3",
  "audio/mp3": ".mp3",
  "audio/mp4": ".m4a",
  "audio/flac": ".flac",
  "audio/ogg": ".oga",
  "application/ogg": ".ogg",

  "video/x-mpeg1": ".mpg",
  "video/x-mpeg2": ".mpeg",
  "video/mp4": ".m4v",
  "video/ogg": ".ogv",
  "video/quicktime": ".mov",
  "video/x-matroska": ".mkv",
  "video/x-msvideo": ".avi",

  "text/plain": ".txt",
  "text/html": ".html",
  "application/json": ".json",
  "application/pdf": ".pdf",
};

const mimetypeByExtension = Object.fromEntries(
  Object.entries(extensionByMimetype).map(([k, v]) => [v, k]),
);

export function withQueryParams(
  url: string,
  queryParams: Record<string, string | number>,
) {
  const entries = Object.entries(queryParams);
  if (!entries.length) return url;
  const usp = new URLSearchParams();
  entries.forEach(([k, v]) => usp.set(k, `${v}`));
  return `${url}?${usp.toString()}`;
}

export function urlJoin(prefix: string, suffix: string): string {
  if (
    prefix.endsWith("/") || prefix.endsWith("#") || prefix.endsWith(":") ||
    suffix.startsWith("/")
  ) {
    return `${prefix}${suffix}`;
  }
  return `${prefix}/${suffix}`;
}

export function localPost(
  id: string,
  options: { page?: number },
  prefix = "/",
): string {
  return withQueryParams(
    urlJoin(prefix, `pub/post/${encodeURIComponent(id)}`),
    options,
  );
}

export function localProfile(
  personaName: string,
  options: { page?: number; view?: "feed" | "replies" | "media" },
  prefix = "/",
): string {
  return withQueryParams(
    urlJoin(prefix, `pub/feed/${encodeURIComponent(personaName)}`),
    options,
  );
}

export function localMedia(hash: string, prefix = "/"): string {
  return urlJoin(prefix, `pub/media/${encodeURIComponent(hash)}`);
}

export function localMediaWithMimetype(
  hash: string,
  mimetype: string,
  prefix = "/",
): string {
  return urlJoin(
    prefix,
    `pub/media/${encodeURIComponent(hash)}${
      extensionByMimetype[mimetype] ?? ""
    }`,
  );
}

export function remotePost(
  id: string,
  options: { page?: number },
  prefix = "/",
): string {
  return withQueryParams(
    urlJoin(prefix, `app/post/${encodeURIComponent(id)}`),
    options,
  );
}

export function remoteProfile(
  acct: string,
  options: { page?: number; view?: "feed" | "replies" | "media" },
  prefix = "/",
): string {
  return withQueryParams(
    urlJoin(prefix, `app/user/${encodeURIComponent(acct)}`),
    options,
  );
}

export function remoteMedia(hash: string, prefix = "/"): string {
  return urlJoin(prefix, `app/media/${encodeURIComponent(hash)}`);
}

export function composePost(prefix = "/"): string {
  return urlJoin(prefix, "app/compose");
}

export function editPost(id: string, prefix = "/"): string {
  return urlJoin(prefix, `app/edit/${encodeURIComponent(id)}`);
}

export function deletePost(id: string, prefix = "/"): string {
  return urlJoin(prefix, `app/delete/${encodeURIComponent(id)}`);
}

export function reactToPost(id: string, prefix = "/"): string {
  return urlJoin(prefix, `app/react/${encodeURIComponent(id)}`);
}

export function boostPost(id: string, prefix = "/"): string {
  return urlJoin(prefix, `app/boost/${encodeURIComponent(id)}`);
}

export function remoteMediaWithMimetype(
  hash: string,
  mimetype: string,
  prefix = "/",
): string {
  return urlJoin(
    prefix,
    `app/media/${encodeURIComponent(hash)}${
      extensionByMimetype[mimetype] ?? ""
    }`,
  );
}

export function extensionToMimetype(extension: string): string | undefined {
  return mimetypeByExtension[extension];
}

export function activityPubActor(personaName: string, prefix = "/"): string {
  return urlJoin(prefix, `ap/actor/${encodeURIComponent(personaName)}`);
}

export function isActivityPubActor(url: string, prefix = "/"): string | null {
  url = url.toLowerCase();
  prefix = urlJoin(prefix, "ap/actor/");
  if (!url.startsWith(prefix)) return null;
  const actor = url.slice(prefix.length);
  if (isPersonaName(actor)) return actor;
  return null;
}

export function activityPubInbox(personaName: string, prefix = "/"): string {
  return `${activityPubActor(personaName, prefix)}/inbox`;
}

export function activityPubOutbox(personaName: string, prefix = "/"): string {
  return `${activityPubActor(personaName, prefix)}/outbox`;
}

export function activityPubObject(id: string, prefix = "/"): string {
  return urlJoin(prefix, `ap/object/${encodeURIComponent(id)}`);
}

export function activityPubActivity(id: string, prefix = "/"): string {
  return urlJoin(prefix, `ap/activity/${encodeURIComponent(id)}`);
}

export function activityPubContext(prefix = "/"): string {
  return urlJoin(prefix, "ap/context");
}

export function isActivityPubActivity(
  url: string,
  prefix = "/",
): string | null {
  url = url.toLowerCase();
  prefix = urlJoin(prefix, "ap/activity/");
  if (!url.startsWith(prefix)) return null;
  return url.slice(prefix.length);
}

export function activityPubFollowing(
  personaName: string,
  prefix = "/",
): string {
  return `${activityPubActor(personaName, prefix)}/following`;
}

export function activityPubFollowers(
  personaName: string,
  prefix = "/",
): string {
  return `${activityPubActor(personaName, prefix)}/followers`;
}

export function isActivityPubFollowers(
  url: string,
  prefix = "/",
): string | null {
  url = url.toLowerCase();
  prefix = urlJoin(prefix, "ap/actor/");
  if (!url.startsWith(prefix)) return null;
  const segments = url.slice(prefix.length).split("/");
  if (segments.length !== 2 || segments[1] !== "followers") return null;
  if (isPersonaName(segments[0])) return segments[0];
  return null;
}

export function contentTypeIsJson(contentType: string) {
  return /^application\/(\w+\+)?json(;.*)?$/i.test(contentType);
}

export const webfinger = "/.well-known/webfinger" as const;
export const nodeInfoDirectory = "/.well-known/nodeinfo" as const;
export const nodeInfoV2_0 = "/ndoeinfo/2.0" as const;
