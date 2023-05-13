/*
 * Based on https://github.com/digitalbazaar/rdf-canonize
 * Original code (c) 2016-2022 Digital Bazaar, Inc.; BSD licensed
 */

import { IdentifierIssuer } from "./IdentifierIssuer.ts";
import { MessageDigest, WebCryptoMessageDigest } from "./MessageDigest.ts";
import * as NQuads from "./NQuads.ts";
import { Permuter } from "./Permuter.ts";
import { Quad, Term } from "./types.ts";

interface Info {
  quads: Set<Quad>;
  hash: string | null;
}

export class URDNA2015 {
  readonly name = "URDNA2015";
  readonly #blankNodeInfo = new Map<string, Info>();
  #canonicalIssuer = new IdentifierIssuer("c14n");
  #quads: Quad[] = [];
  #deepIterations = new Map<string, number>();
  readonly #createMessageDigest: () => MessageDigest;
  readonly #maxDeepIterations: number;

  constructor({
    createMessageDigest = () => new WebCryptoMessageDigest("SHA-256"),
    maxDeepIterations = Infinity,
  }: {
    createMessageDigest?: () => MessageDigest;
    maxDeepIterations?: number;
  } = {}) {
    this.#createMessageDigest = createMessageDigest;
    this.#maxDeepIterations = maxDeepIterations;
  }

  // 4.4) Normalization Algorithm
  async main(dataset: Quad[]) {
    this.#deepIterations = new Map();
    this.#quads = dataset;

    // 1) Create the normalization state.
    // 2) For every quad in input dataset:
    for (const quad of dataset) {
      // 2.1) For each blank node that occurs in the quad, add a reference
      // to the quad using the blank node identifier in the blank node to
      // quads map, creating a new entry if necessary.
      this.#addBlankNodeQuadInfo({ quad, component: quad.subject });
      this.#addBlankNodeQuadInfo({ quad, component: quad.object });
      this.#addBlankNodeQuadInfo({ quad, component: quad.graph });
    }

    // 3) Create a list of non-normalized blank node identifiers
    // non-normalized identifiers and populate it using the keys from the
    // blank node to quads map.
    // Note: We use a map here and it was generated during step 2.

    // 4) `simple` flag is skipped -- loop is optimized away. This optimization
    // is permitted because there was a typo in the hash first degree quads
    // algorithm in the URDNA2015 spec that was implemented widely making it
    // such that it could not be fixed; the result was that the loop only
    // needs to be run once and the first degree quad hashes will never change.
    // 5.1-5.2 are skipped; first degree quad hashes are generated just once
    // for all non-normalized blank nodes.

    // 5.3) For each blank node identifier identifier in non-normalized
    // identifiers:
    const hashToBlankNodes = new Map();
    const nonNormalized = [...this.#blankNodeInfo.keys()];
    let i = 0;
    for (const id of nonNormalized) {
      // Note: batch hashing first degree quads 100 at a time
      if (++i % 100 === 0) {
        await this.#yield();
      }
      // steps 5.3.1 and 5.3.2:
      await this.#hashAndTrackBlankNode({ id, hashToBlankNodes });
    }

    // 5.4) For each hash to identifier list mapping in hash to blank
    // nodes map, lexicographically-sorted by hash:
    const hashes = [...hashToBlankNodes.keys()].sort();
    // optimize away second sort, gather non-unique hashes in order as we go
    const nonUnique = [];
    for (const hash of hashes) {
      // 5.4.1) If the length of identifier list is greater than 1,
      // continue to the next mapping.
      const idList = hashToBlankNodes.get(hash);
      if (idList.length > 1) {
        nonUnique.push(idList);
        continue;
      }

      // 5.4.2) Use the Issue Identifier algorithm, passing canonical
      // issuer and the single blank node identifier in identifier
      // list, identifier, to issue a canonical replacement identifier
      // for identifier.
      const id = idList[0];
      this.#canonicalIssuer.getId(id);

      // Note: These steps are skipped, optimized away since the loop
      // only needs to be run once.
      // 5.4.3) Remove identifier from non-normalized identifiers.
      // 5.4.4) Remove hash from the hash to blank nodes map.
      // 5.4.5) Set simple to true.
    }

    // 6) For each hash to identifier list mapping in hash to blank nodes map,
    // lexicographically-sorted by hash:
    // Note: sort optimized away, use `nonUnique`.
    for (const idList of nonUnique) {
      // 6.1) Create hash path list where each item will be a result of
      // running the Hash N-Degree Quads algorithm.
      const hashPathList = [];

      // 6.2) For each blank node identifier identifier in identifier list:
      for (const id of idList) {
        // 6.2.1) If a canonical identifier has already been issued for
        // identifier, continue to the next identifier.
        if (this.#canonicalIssuer.hasId(id)) {
          continue;
        }

        // 6.2.2) Create temporary issuer, an identifier issuer
        // initialized with the prefix _:b.
        const issuer = new IdentifierIssuer("b");

        // 6.2.3) Use the Issue Identifier algorithm, passing temporary
        // issuer and identifier, to issue a new temporary blank node
        // identifier for identifier.
        issuer.getId(id);

        // 6.2.4) Run the Hash N-Degree Quads algorithm, passing
        // temporary issuer, and append the result to the hash path list.
        const result = await this.hashNDegreeQuads(id, issuer);
        hashPathList.push(result);
      }

      // 6.3) For each result in the hash path list,
      // lexicographically-sorted by the hash in result:
      hashPathList.sort(stringHashCompare);
      for (const result of hashPathList) {
        // 6.3.1) For each blank node identifier, existing identifier,
        // that was issued a temporary identifier by identifier issuer
        // in result, issue a canonical identifier, in the same order,
        // using the Issue Identifier algorithm, passing canonical
        // issuer and existing identifier.
        const oldIds = result.issuer.getOldIds();
        for (const id of oldIds) {
          this.#canonicalIssuer.getId(id);
        }
      }
    }

    /* Note: At this point all blank nodes in the set of RDF quads have been
    assigned canonical identifiers, which have been stored in the canonical
    issuer. Here each quad is updated by assigning each of its blank nodes
    its new identifier. */

    // 7) For each quad, quad, in input dataset:
    const normalized: string[] = [];
    for (const quad of this.#quads) {
      // 7.1) Create a copy, quad copy, of quad and replace any existing
      // blank node identifiers using the canonical identifiers
      // previously issued by canonical issuer.
      // Note: We optimize away the copy here.
      const nQuad = NQuads.serializeQuadComponents(
        this.#componentWithCanonicalId(quad.subject),
        quad.predicate,
        this.#componentWithCanonicalId(quad.object),
        this.#componentWithCanonicalId(quad.graph),
      );
      // 7.2) Add quad copy to the normalized dataset.
      normalized.push(nQuad);
    }

    // sort normalized output
    normalized.sort();

    // 8) Return the normalized dataset.
    return normalized.join("");
  }

  // 4.6) Hash First Degree Quads
  async hashFirstDegreeQuads(id: string) {
    // 1) Initialize nquads to an empty list. It will be used to store quads in
    // N-Quads format.
    const nquads = [];

    // 2) Get the list of quads `quads` associated with the reference blank node
    // identifier in the blank node to quads map.
    const info = this.#blankNodeInfo.get(id)!;
    const quads = info.quads;

    // 3) For each quad `quad` in `quads`:
    for (const quad of quads) {
      // 3.1) Serialize the quad in N-Quads format with the following special
      // rule:

      // 3.1.1) If any component in quad is an blank node, then serialize it
      // using a special identifier as follows:
      // 3.1.2) If the blank node's existing blank node identifier matches
      // the reference blank node identifier then use the blank node
      // identifier _:a, otherwise, use the blank node identifier _:z.
      nquads.push(NQuads.serializeQuadComponents(
        this.modifyFirstDegreeComponent(id, quad.subject, "subject"),
        quad.predicate,
        this.modifyFirstDegreeComponent(id, quad.object, "object"),
        this.modifyFirstDegreeComponent(id, quad.graph, "graph"),
      ));
    }

    // 4) Sort nquads in lexicographical order.
    nquads.sort();

    // 5) Return the hash that results from passing the sorted, joined nquads
    // through the hash algorithm.
    const md = this.#createMessageDigest();
    for (const nquad of nquads) {
      md.update(nquad);
    }
    info.hash = await md.digest();
    return info.hash;
  }

  // 4.7) Hash Related Blank Node
  async hashRelatedBlankNode(
    related: string,
    quad: Quad,
    issuer: IdentifierIssuer,
    position: "s" | "o" | "g",
  ) {
    // 1) Set the identifier to use for related, preferring first the canonical
    // identifier for related if issued, second the identifier issued by issuer
    // if issued, and last, if necessary, the result of the Hash First Degree
    // Quads algorithm, passing related.
    let id;
    if (this.#canonicalIssuer.hasId(related)) {
      id = this.#canonicalIssuer.getId(related);
    } else if (issuer.hasId(related)) {
      id = issuer.getId(related);
    } else {
      id = this.#blankNodeInfo.get(related)!.hash!;
    }

    // 2) Initialize a string input to the value of position.
    // Note: We use a hash object instead.
    const md = this.#createMessageDigest();
    md.update(position);

    // 3) If position is not g, append <, the value of the predicate in quad,
    // and > to input.
    if (position !== "g") {
      md.update(this.getRelatedPredicate(quad));
    }

    // 4) Append identifier to input.
    md.update(id);

    // 5) Return the hash that results from passing input through the hash
    // algorithm.
    return md.digest();
  }

  // 4.8) Hash N-Degree Quads
  async hashNDegreeQuads(id: string, issuer: IdentifierIssuer) {
    const deepIterations = this.#deepIterations.get(id) || 0;
    if (deepIterations > this.#maxDeepIterations) {
      throw new Error(
        `Maximum deep iterations (${this.#maxDeepIterations}) exceeded.`,
      );
    }
    this.#deepIterations.set(id, deepIterations + 1);

    // 1) Create a hash to related blank nodes map for storing hashes that
    // identify related blank nodes.
    // Note: 2) and 3) handled within `createHashToRelated`
    const md = this.#createMessageDigest();
    const hashToRelated = await this.createHashToRelated(id, issuer);

    // 4) Create an empty string, data to hash.
    // Note: We created a hash object `md` above instead.

    // 5) For each related hash to blank node list mapping in hash to related
    // blank nodes map, sorted lexicographically by related hash:
    const hashes = [...hashToRelated.keys()].sort();
    for (const hash of hashes) {
      // 5.1) Append the related hash to the data to hash.
      md.update(hash);

      // 5.2) Create a string chosen path.
      let chosenPath = "";

      // 5.3) Create an unset chosen issuer variable.
      let chosenIssuer: IdentifierIssuer = issuer;

      // 5.4) For each permutation of blank node list:
      const permuter = new Permuter(hashToRelated.get(hash) ?? []);
      let i = 0;
      while (permuter.hasNext()) {
        const permutation = permuter.next();
        // Note: batch permutations 3 at a time
        if (++i % 3 === 0) {
          await this.#yield();
        }

        // 5.4.1) Create a copy of issuer, issuer copy.
        let issuerCopy = issuer.clone();

        // 5.4.2) Create a string path.
        let path = "";

        // 5.4.3) Create a recursion list, to store blank node identifiers
        // that must be recursively processed by this algorithm.
        const recursionList = [];

        // 5.4.4) For each related in permutation:
        let nextPermutation = false;
        for (const related of permutation) {
          // 5.4.4.1) If a canonical identifier has been issued for
          // related, append it to path.
          if (this.#canonicalIssuer.hasId(related)) {
            path += this.#canonicalIssuer.getId(related);
          } else {
            // 5.4.4.2) Otherwise:
            // 5.4.4.2.1) If issuer copy has not issued an identifier for
            // related, append related to recursion list.
            if (!issuerCopy.hasId(related)) {
              recursionList.push(related);
            }
            // 5.4.4.2.2) Use the Issue Identifier algorithm, passing
            // issuer copy and related and append the result to path.
            path += issuerCopy.getId(related);
          }

          // 5.4.4.3) If chosen path is not empty and the length of path
          // is greater than or equal to the length of chosen path and
          // path is lexicographically greater than chosen path, then
          // skip to the next permutation.
          // Note: Comparing path length to chosen path length can be optimized
          // away; only compare lexicographically.
          if (chosenPath.length !== 0 && path > chosenPath) {
            nextPermutation = true;
            break;
          }
        }

        if (nextPermutation) {
          continue;
        }

        // 5.4.5) For each related in recursion list:
        for (const related of recursionList) {
          // 5.4.5.1) Set result to the result of recursively executing
          // the Hash N-Degree Quads algorithm, passing related for
          // identifier and issuer copy for path identifier issuer.
          const result = await this.hashNDegreeQuads(related, issuerCopy);

          // 5.4.5.2) Use the Issue Identifier algorithm, passing issuer
          // copy and related and append the result to path.
          path += issuerCopy.getId(related);

          // 5.4.5.3) Append <, the hash in result, and > to path.
          path += `<${result.hash}>`;

          // 5.4.5.4) Set issuer copy to the identifier issuer in
          // result.
          issuerCopy = result.issuer;

          // 5.4.5.5) If chosen path is not empty and the length of path
          // is greater than or equal to the length of chosen path and
          // path is lexicographically greater than chosen path, then
          // skip to the next permutation.
          // Note: Comparing path length to chosen path length can be optimized
          // away; only compare lexicographically.
          if (chosenPath.length !== 0 && path > chosenPath) {
            nextPermutation = true;
            break;
          }
        }

        if (nextPermutation) {
          continue;
        }

        // 5.4.6) If chosen path is empty or path is lexicographically
        // less than chosen path, set chosen path to path and chosen
        // issuer to issuer copy.
        if (chosenPath.length === 0 || path < chosenPath) {
          chosenPath = path;
          chosenIssuer = issuerCopy;
        }
      }

      // 5.5) Append chosen path to data to hash.
      md.update(chosenPath);

      // 5.6) Replace issuer, by reference, with chosen issuer.
      issuer = chosenIssuer;
    }

    // 6) Return issuer and the hash that results from passing data to hash
    // through the hash algorithm.
    return { hash: await md.digest(), issuer };
  }

  // helper for modifying component during Hash First Degree Quads
  modifyFirstDegreeComponent<C extends keyof Quad>(
    id: string,
    component: Quad[C],
    _key: C,
  ): Quad[C] {
    if (component.termType !== "BlankNode") {
      return component;
    }
    /* Note: A mistake in the URDNA2015 spec that made its way into
    implementations (and therefore must stay to avoid interop breakage)
    resulted in an assigned canonical ID, if available for
    `component.value`, not being used in place of `_:a`/`_:z`, so
    we don't use it here. */
    return {
      termType: "BlankNode",
      value: component.value === id ? "a" : "z",
    } as Quad[C];
  }

  // helper for getting a related predicate
  getRelatedPredicate(quad: Quad) {
    return `<${quad.predicate.value}>`;
  }

  // helper for creating hash to related blank nodes map
  async createHashToRelated(
    id: string,
    issuer: IdentifierIssuer,
  ): Promise<Map<string, string[]>> {
    // 1) Create a hash to related blank nodes map for storing hashes that
    // identify related blank nodes.
    const hashToRelated = new Map<string, string[]>();

    // 2) Get a reference, quads, to the list of quads in the blank node to
    // quads map for the key identifier.
    const quads = this.#blankNodeInfo.get(id)?.quads ?? [];

    // 3) For each quad in quads:
    let i = 0;
    for (const quad of quads) {
      // Note: batch hashing related blank node quads 100 at a time
      if (++i % 100 === 0) {
        await this.#yield();
      }
      // 3.1) For each component in quad, if component is the subject, object,
      // and graph name and it is a blank node that is not identified by
      // identifier:
      // steps 3.1.1 and 3.1.2 occur in helpers:
      await Promise.all([
        this.#addRelatedBlankNodeHash({
          quad,
          component: quad.subject,
          position: "s",
          id,
          issuer,
          hashToRelated,
        }),
        this.#addRelatedBlankNodeHash({
          quad,
          component: quad.object,
          position: "o",
          id,
          issuer,
          hashToRelated,
        }),
        this.#addRelatedBlankNodeHash({
          quad,
          component: quad.graph,
          position: "g",
          id,
          issuer,
          hashToRelated,
        }),
      ]);
    }

    return hashToRelated;
  }

  async #hashAndTrackBlankNode(
    { id, hashToBlankNodes }: {
      id: string;
      hashToBlankNodes: Map<string, string[]>;
    },
  ) {
    // 5.3.1) Create a hash, hash, according to the Hash First Degree
    // Quads algorithm.
    const hash = await this.hashFirstDegreeQuads(id);

    // 5.3.2) Add hash and identifier to hash to blank nodes map,
    // creating a new entry if necessary.
    const idList = hashToBlankNodes.get(hash);
    if (!idList) {
      hashToBlankNodes.set(hash, [id]);
    } else {
      idList.push(id);
    }
  }

  #addBlankNodeQuadInfo(
    { quad, component }: { quad: Quad; component: Term },
  ) {
    if (component.termType !== "BlankNode") {
      return;
    }
    const id = component.value;
    const info = this.#blankNodeInfo.get(id);
    if (info) {
      info.quads.add(quad);
    } else {
      this.#blankNodeInfo.set(id, { quads: new Set([quad]), hash: null });
    }
  }

  async #addRelatedBlankNodeHash(
    { quad, component, position, id, issuer, hashToRelated }: {
      quad: Quad;
      component: Term;
      position: "s" | "o" | "g";
      id: string;
      issuer: IdentifierIssuer;
      hashToRelated: Map<string, string[]>;
    },
  ) {
    if (!(component.termType === "BlankNode" && component.value !== id)) {
      return;
    }
    // 3.1.1) Set hash to the result of the Hash Related Blank Node
    // algorithm, passing the blank node identifier for component as
    // related, quad, path identifier issuer as issuer, and position as
    // either s, o, or g based on whether component is a subject, object,
    // graph name, respectively.
    const related = component.value;
    const hash = await this.hashRelatedBlankNode(
      related,
      quad,
      issuer,
      position,
    );

    // 3.1.2) Add a mapping of hash to the blank node identifier for
    // component to hash to related blank nodes map, adding an entry as
    // necessary.
    const entries = hashToRelated.get(hash);
    if (entries) {
      entries.push(related);
    } else {
      hashToRelated.set(hash, [related]);
    }
  }

  // canonical ids for 7.1
  #componentWithCanonicalId<T extends Term>(component: T): T {
    if (
      component.termType === "BlankNode" &&
      !component.value.startsWith(this.#canonicalIssuer.prefix)
    ) {
      // create new BlankNode
      return {
        termType: "BlankNode",
        value: this.#canonicalIssuer.getId(component.value),
      } as T;
    }
    return component;
  }

  #yield() {
    return new Promise((resolve) => setTimeout(resolve, 0));
  }
}

function stringHashCompare(a: { hash: string }, b: { hash: string }) {
  return a.hash < b.hash ? -1 : a.hash > b.hash ? 1 : 0;
}
