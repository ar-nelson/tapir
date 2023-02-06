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
  return urlJoin(prefix, `toot/${id}`);
}

export function profile(personaName: string, prefix = "/"): string {
  return urlJoin(prefix, `@${personaName}`);
}

export function activityPubRoot(personaName: string, prefix = "/"): string {
  return urlJoin(prefix, `users/${personaName}`);
}
