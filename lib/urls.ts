import { isPersonaName } from "$/lib/utils.ts";
import {
  ProfileFeed,
  ProtoAddr,
  protoAddrToString,
  Protocol,
} from "$/models/types.ts";

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
  options: { page?: string },
  prefix = "/",
): string {
  return withQueryParams(
    urlJoin(prefix, `pub/post/${encodeURIComponent(id)}`),
    options,
  );
}

export function localProfile(
  personaName: string,
  options: { page?: string; view?: ProfileFeed },
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
  addr: ProtoAddr,
  options: { page?: string },
  prefix = "/",
): string {
  return withQueryParams(
    urlJoin(prefix, `app/post`),
    { ...options, p: addr.protocol, u: addr.path },
  );
}

export function remoteProfile(
  addr: ProtoAddr,
  options: { page?: string; view?: ProfileFeed },
  prefix = "/",
): string {
  return withQueryParams(
    urlJoin(prefix, `app/profile`),
    { ...options, p: addr.protocol, u: addr.path },
  );
}

export function remoteFollowers(
  addr: ProtoAddr,
  options: { page?: string },
  prefix = "/",
): string {
  return withQueryParams(
    urlJoin(prefix, `app/profile/followers`),
    { ...options, p: addr.protocol, u: addr.path },
  );
}

export function remoteFollowing(
  addr: ProtoAddr,
  options: { page?: string },
  prefix = "/",
): string {
  return withQueryParams(
    urlJoin(prefix, `app/profile/following`),
    { ...options, p: addr.protocol, u: addr.path },
  );
}

export function remoteInstance(addr: ProtoAddr, prefix = "/") {
  return withQueryParams(
    urlJoin(prefix, `app/instance`),
    { p: addr.protocol, u: addr.path },
  );
}

export function remoteFeed(
  addr: ProtoAddr,
  options: { page?: string },
  prefix = "/",
) {
  return withQueryParams(
    urlJoin(prefix, `app/feed/remote`),
    { ...options, p: addr.protocol, u: addr.path },
  );
}

export function remoteMedia(hash: string, prefix = "/"): string {
  return urlJoin(prefix, `app/media/${encodeURIComponent(hash)}`);
}

export function remoteMediaPreload(
  remoteUrl: string,
  prefix = "/",
): string {
  return withQueryParams(
    urlJoin(
      prefix,
      "app/media/preload",
    ),
    { url: remoteUrl },
  );
}

export function composePost(
  { persona, dm, replyTo, quote }: {
    persona?: string;
    dm?: ProtoAddr | ProtoAddr[];
    replyTo?: ProtoAddr;
    quote?: ProtoAddr;
  },
  prefix = "/",
): string {
  return withQueryParams(
    urlJoin(prefix, "app/compose"),
    {
      ...persona ? { persona } : {},
      ...dm
        ? {
          dm: Array.isArray(dm)
            ? dm.map(protoAddrToString).join(",")
            : protoAddrToString(dm),
        }
        : {},
      ...replyTo ? { replyTo: protoAddrToString(replyTo) } : {},
      ...quote ? { quote: protoAddrToString(quote) } : {},
    },
  );
}

export function composePostSubmit(prefix = "/") {
  return urlJoin(prefix, "app/compose");
}

export function editPost(id: string, prefix = "/"): string {
  return urlJoin(prefix, `app/edit/${encodeURIComponent(id)}`);
}

export function deletePost(id: string, prefix = "/"): string {
  return urlJoin(prefix, `app/delete/${encodeURIComponent(id)}`);
}

export function reactToPost(addr: ProtoAddr, prefix = "/"): string {
  return withQueryParams(
    urlJoin(prefix, `app/react`),
    { p: addr.protocol, u: addr.path },
  );
}

export function reactToPostSubmit(prefix = "/"): string {
  return urlJoin(prefix, `app/react`);
}

export function boostPostSubmit(prefix = "/"): string {
  return urlJoin(prefix, `app/submit`);
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

export function activityPubMainKey(personaName: string, prefix = "/"): string {
  return `${activityPubActor(personaName, prefix)}#main-key`;
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
export const nodeInfoV2_1 = "/nodeinfo/2.1" as const;
export const nodeInfoV2_0 = "/nodeinfo/2.0" as const;

export function protoAddrInstance(
  addr: ProtoAddr,
  config: { readonly url: string },
): string | undefined {
  switch (addr.protocol) {
    case Protocol.Local:
      return config.url;
    case Protocol.ActivityPub:
      return new URL("", addr.path).href;
    case Protocol.Mastodon:
      if (addr.path.includes(":")) {
        return new URL("", addr.path).href;
      } else if (addr.path.includes("@")) {
        return `https://${addr.path.slice(addr.path.lastIndexOf("@") + 1)}`;
      }
  }
}

export function normalizeDomain(domain: string): string {
  domain = domain.replaceAll(/\.+/g, ".").toLowerCase();
  return domain.endsWith(".") ? domain : `${domain}.`;
}

export function isSubdomainOf(
  parentDomain: string,
  subdomain: string | URL,
): boolean {
  parentDomain = normalizeDomain(parentDomain);
  subdomain = normalizeDomain(
    typeof subdomain === "string" ? subdomain : subdomain.hostname,
  );
  return subdomain === parentDomain || parentDomain === "." ||
    subdomain.endsWith(`.${parentDomain}`);
}
