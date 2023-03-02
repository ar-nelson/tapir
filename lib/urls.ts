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

export function urlJoin(prefix: string, suffix: string): string {
  if (
    prefix.endsWith("/") || prefix.endsWith("#") || prefix.endsWith(":") ||
    suffix.startsWith("/")
  ) {
    return `${prefix}${suffix}`;
  }
  return `${prefix}/${suffix}`;
}

export function localPost(id: string, prefix = "/"): string {
  return urlJoin(prefix, `toot/${encodeURIComponent(id)}`);
}

export function profile(personaName: string, prefix = "/"): string {
  return urlJoin(prefix, `@${encodeURIComponent(personaName)}`);
}

export function activityPubActor(personaName: string, prefix = "/"): string {
  return urlJoin(prefix, `ap/actor/${encodeURIComponent(personaName)}`);
}

export function localMedia(hash: string, prefix = "/"): string {
  return urlJoin(prefix, `media/local/${encodeURIComponent(hash)}`);
}

export function localMediaWithMimetype(
  hash: string,
  mimetype: string,
  prefix = "/",
): string {
  return urlJoin(
    prefix,
    `media/local/${encodeURIComponent(hash)}${
      extensionByMimetype[mimetype] ?? ""
    }`,
  );
}

export function extensionToMimetype(extension: string): string | undefined {
  return mimetypeByExtension[extension];
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
