/**
 * Prepends a base IRI to the given relative IRI.
 *
 * @param base the base IRI.
 * @param iri the relative IRI.
 *
 * @return the absolute IRI.
 */
export const prependBase = (base: URL | string | null, iri: string) => {
  // skip IRI processing
  if (base == null) {
    return iri;
  }
  // already an absolute IRI
  if (isAbsolute(iri)) {
    return iri;
  }

  return new URL(iri, base).href;
};

/**
 * Removes a base IRI from the given absolute IRI.
 *
 * @param base the base IRI.
 * @param iri the absolute IRI.
 *
 * @return the relative IRI if relative to base, otherwise the absolute IRI.
 */
export const removeBase = (base: URL | string | null, iri: string): string => {
  // skip IRI processing
  if (base == null) {
    return iri;
  }

  if (typeof base === "string") {
    base = new URL(base);
  }

  // establish base root
  let root = "";
  if (base.href !== "") {
    root += (base.protocol || "") + "//" + (base.host || "");
  } else if (iri.indexOf("//")) {
    // support network-path reference with empty base
    root += "//";
  }

  // IRI not relative to base
  if (iri.indexOf(root) !== 0) {
    return iri;
  }

  // remove root from IRI and parse remainder
  const rel = new URL(iri.substr(root.length));

  // remove path segments that match (do not remove last segment unless there
  // is a hash or query)
  const baseSegments = base.pathname.split("/");
  const iriSegments = rel.pathname.split("/");
  const last = (rel.hash || rel.search) ? 0 : 1;
  while (baseSegments.length > 0 && iriSegments.length > last) {
    if (baseSegments[0] !== iriSegments[0]) {
      break;
    }
    baseSegments.shift();
    iriSegments.shift();
  }

  // use '../' for each non-matching base segment
  let rval = "";
  if (baseSegments.length > 0) {
    // don't count the last segment (if it ends with '/' last path doesn't
    // count and if it doesn't end with '/' it isn't a path)
    baseSegments.pop();
    for (let i = 0; i < baseSegments.length; ++i) {
      rval += "../";
    }
  }

  // prepend remaining segments
  rval += iriSegments.join("/");

  // add query and hash
  if (rel.search != null) {
    rval += "?" + rel.search;
  }
  if (rel.hash != null) {
    rval += "#" + rel.hash;
  }

  // handle empty base
  if (rval === "") {
    rval = "./";
  }

  return rval;
};

/**
 * Removes dot segments from a URL path.
 *
 * @param path the path to remove dot segments from.
 */
export const removeDotSegments = (path: string) => {
  // RFC 3986 5.2.4 (reworked)

  // empty path shortcut
  if (path.length === 0) {
    return "";
  }

  const input = path.split("/");
  const output = [];

  while (input.length > 0) {
    const next = input.shift();
    const done = input.length === 0;

    if (next === ".") {
      if (done) {
        // ensure output has trailing /
        output.push("");
      }
      continue;
    }

    if (next === "..") {
      output.pop();
      if (done) {
        // ensure output has trailing /
        output.push("");
      }
      continue;
    }

    output.push(next);
  }

  // if path was absolute, ensure output has leading /
  if (path[0] === "/" && output.length > 0 && output[0] !== "") {
    output.unshift("");
  }
  if (output.length === 1 && output[0] === "") {
    return "/";
  }

  return output.join("/");
};

// TODO: time better isAbsolute/isRelative checks using full regexes:
// http://jmrware.com/articles/2009/uri_regexp/URI_regex.html

// regex to check for absolute IRI (starting scheme and ':') or blank node IRI
export const isAbsoluteRegex = /^([A-Za-z][A-Za-z0-9+-.]*|_):[^\s]*$/;

/**
 * Returns true if the given value is an absolute IRI or blank node IRI, false
 * if not.
 * Note: This weak check only checks for a correct starting scheme.
 *
 * @param v the value to check.
 *
 * @return true if the value is an absolute IRI, false if not.
 */
export const isAbsolute = (v: unknown): v is string =>
  typeof v === "string" && isAbsoluteRegex.test(v);

/**
 * Returns true if the given value is a relative IRI, false if not.
 * Note: this is a weak check.
 *
 * @param v the value to check.
 *
 * @return true if the value is a relative IRI, false if not.
 */
export const isRelative = (v: unknown): v is string => typeof v === "string";
