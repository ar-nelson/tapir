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

export function activityPubRoot(personaName: string, prefix = "/"): string {
  return urlJoin(prefix, `users/${encodeURIComponent(personaName)}`);
}

export function activityPubInbox(personaName: string, prefix = "/"): string {
  return `${activityPubRoot(personaName, prefix)}/inbox`;
}

export function activityPubOutbox(personaName: string, prefix = "/"): string {
  return `${activityPubRoot(personaName, prefix)}/outbox`;
}

export function activityPubPost(
  personaName: string,
  postId: string,
  prefix = "/",
): string {
  return `${activityPubRoot(personaName, prefix)}/statuses/${
    encodeURIComponent(postId)
  }`;
}

export function activityPubPostActivity(
  personaName: string,
  postId: string,
  prefix = "/",
): string {
  return `${activityPubPost(personaName, postId, prefix)}/activity`;
}

export function activityPubFollowing(
  personaName: string,
  prefix = "/",
): string {
  return `${activityPubRoot(personaName, prefix)}/following`;
}

export function activityPubFollowers(
  personaName: string,
  prefix = "/",
): string {
  return `${activityPubRoot(personaName, prefix)}/followers`;
}

export function contentTypeIsJson(contentType: string) {
  return /^application\/(\w+\+)?json(;.*)?$/i.test(contentType);
}
