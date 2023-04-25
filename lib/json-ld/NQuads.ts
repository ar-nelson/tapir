/*
 * Based on https://github.com/digitalbazaar/rdf-canonize
 * Original code (c) 2016-2022 Digital Bazaar, Inc.; BSD licensed
 */

import { RDF_LANGSTRING, XSD_STRING } from "./constants.ts";
import { isTreeLink } from "./toRdf.ts";
import {
  GraphTerm,
  LiteralTerm,
  ObjectTerm,
  PredicateTerm,
  Quad,
  RdfEvent,
  SubjectTerm,
  TermType,
} from "./types.ts";

// build regexes
let REGEX: { eoln: RegExp; empty: RegExp; quad: RegExp };
{
  const iri = "(?:<([^:]+:[^>]*)>)";
  // https://www.w3.org/TR/turtle/#grammar-production-BLANK_NODE_LABEL
  const PN_CHARS_BASE = "A-Z" + "a-z" +
    "\u00C0-\u00D6" +
    "\u00D8-\u00F6" +
    "\u00F8-\u02FF" +
    "\u0370-\u037D" +
    "\u037F-\u1FFF" +
    "\u200C-\u200D" +
    "\u2070-\u218F" +
    "\u2C00-\u2FEF" +
    "\u3001-\uD7FF" +
    "\uF900-\uFDCF" +
    "\uFDF0-\uFFFD";
  // TODO:
  //'\u10000-\uEFFFF';
  const PN_CHARS_U = PN_CHARS_BASE +
    "_";
  const PN_CHARS = PN_CHARS_U +
    "0-9" +
    "-" +
    "\u00B7" +
    "\u0300-\u036F" +
    "\u203F-\u2040";
  const BLANK_NODE_LABEL = "(_:" +
    "(?:[" + PN_CHARS_U + "0-9])" +
    "(?:(?:[" + PN_CHARS + ".])*(?:[" + PN_CHARS + "]))?" +
    ")";
  const bnode = BLANK_NODE_LABEL;
  const plain = '"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"';
  const datatype = "(?:\\^\\^" + iri + ")";
  const language = "(?:@([a-zA-Z]+(?:-[a-zA-Z0-9]+)*))";
  const literal = "(?:" + plain + "(?:" + datatype + "|" + language + ")?)";
  const ws = "[ \\t]+";
  const wso = "[ \\t]*";

  // define quad part regexes
  const subject = "(?:" + iri + "|" + bnode + ")" + ws;
  const property = iri + ws;
  const object = "(?:" + iri + "|" + bnode + "|" + literal + ")" + wso;
  const graphName = "(?:\\.|(?:(?:" + iri + "|" + bnode + ")" + wso + "\\.))";

  // end of line and empty regexes
  REGEX = {
    eoln: /(?:\r\n)|(?:\n)|(?:\r)/g,
    empty: new RegExp("^" + wso + "$"),

    // full quad regex
    quad: new RegExp(
      "^" + wso + subject + property + object + graphName + wso + "$",
    ),
  };
}

/**
 * Parses RDF in the form of N-Quads.
 *
 * @param input the N-Quads input to parse.
 *
 * @return an RDF dataset (an array of quads per http://rdf.js.org/).
 */
export function parse(input: string): Quad[] {
  // build RDF dataset
  const dataset: Quad[] = [];

  const graphs: Record<string, Quad[]> = {};

  // split N-Quad input into lines
  const lines = input.split(REGEX.eoln);
  let lineNumber = 0;
  for (const line of lines) {
    lineNumber++;

    // skip empty lines
    if (REGEX.empty.test(line)) {
      continue;
    }

    // parse quad
    const match = line.match(REGEX.quad);
    if (match === null) {
      throw new Error(`N-Quads parse error on line ${lineNumber}.`);
    }

    // create RDF quad
    let subject: SubjectTerm, object: ObjectTerm, graph: GraphTerm;

    // get subject
    if (match[1] !== undefined) {
      subject = { termType: TermType.NAMED_NODE, value: match[1] };
    } else {
      subject = { termType: TermType.BLANK_NODE, value: match[2] };
    }

    // get predicate
    const predicate = {
      termType: TermType.NAMED_NODE,
      value: match[3],
    } as const;

    // get object
    if (match[4] !== undefined) {
      object = { termType: TermType.NAMED_NODE, value: match[4] };
    } else if (match[5] !== undefined) {
      object = { termType: TermType.BLANK_NODE, value: match[5] };
    } else {
      object = {
        termType: TermType.LITERAL,
        value: _unescape(match[6]),
        datatype: {
          termType: TermType.NAMED_NODE,
          ...(
            match[7] !== undefined
              ? { value: match[7] }
              : (match[8] !== undefined
                ? { value: RDF_LANGSTRING, language: match[8] }
                : { value: XSD_STRING })
          ),
        },
      };
    }

    // get graph
    if (match[9] !== undefined) {
      graph = {
        termType: TermType.NAMED_NODE,
        value: match[9],
      };
    } else if (match[10] !== undefined) {
      graph = {
        termType: TermType.BLANK_NODE,
        value: match[10],
      };
    } else {
      graph = {
        termType: TermType.DEFAULT_GRAPH,
        value: "",
      };
    }

    const quad = { subject, predicate, object, graph };

    // only add quad if it is unique in its graph
    if (!(graph.value! in graphs)) {
      graphs[graph.value!] = [quad];
      dataset.push(quad);
    } else {
      let unique = true;
      const quads = graphs[graph.value!];
      for (const q of quads) {
        if (_compareTriples(q, quad)) {
          unique = false;
          break;
        }
      }
      if (unique) {
        quads.push(quad);
        dataset.push(quad);
      }
    }
  }

  return dataset;
}

/**
 * Converts an RDF dataset to N-Quads.
 *
 * @param dataset (array of quads) the RDF dataset to convert.
 *
 * @return the N-Quads string.
 */
export function serialize(dataset: Iterable<RdfEvent>): string {
  const quads = [];
  for (const quad of dataset) {
    if (!isTreeLink(quad)) quads.push(serializeQuad(quad));
  }
  return quads.sort().join("");
}

export function subjectToString(s: SubjectTerm): string {
  // subject can only be NamedNode or BlankNode
  if (s.termType === TermType.NAMED_NODE) {
    return `<${s.value}>`;
  }
  return `_:${s.value}`;
}

export function predicateToString(p: PredicateTerm): string {
  // predicate can only be NamedNode
  return `<${p.value}>`;
}

export function objectToString(o: ObjectTerm): string {
  // object is NamedNode, BlankNode, or Literal
  let s: string;
  if (o.termType === TermType.NAMED_NODE) {
    s = `<${o.value}>`;
  } else if (o.termType === TermType.BLANK_NODE) {
    s = `_:${o.value}`;
  } else {
    s = `"${_escape(o.value)}"`;
    if (o.datatype.value === RDF_LANGSTRING) {
      if (o.language) {
        s += `@${o.language}`;
      }
    } else if (o.datatype.value !== XSD_STRING) {
      s += `^^<${o.datatype.value}>`;
    }
  }
  return s;
}

export function graphToString(g: GraphTerm): string {
  // graph can only be NamedNode or BlankNode (or DefaultGraph, but that
  // does not add to `nquad`)
  if (g.termType === TermType.NAMED_NODE) {
    return `<${g.value}>`;
  } else if (g.termType === TermType.BLANK_NODE) {
    return `_:${g.value}`;
  }
  return ".";
}

/**
 * Converts RDF quad components to an N-Quad string (a single quad).
 *
 * @param s - N-Quad subject component.
 * @param p - N-Quad predicate component.
 * @param o - N-Quad object component.
 * @param g - N-Quad graph component.
 *
 * @return the N-Quad.
 */
export function serializeQuadComponents(
  s: SubjectTerm,
  p: PredicateTerm,
  o: ObjectTerm,
  g: GraphTerm,
): string {
  return `${subjectToString(s)} ${predicateToString(p)} ${objectToString(o)} ${
    graphToString(g)
  }\n`;
}

/**
 * Converts an RDF quad to an N-Quad string (a single quad).
 *
 * @param quad the RDF quad convert.
 *
 * @return the N-Quad string.
 */
export function serializeQuad(quad: Quad): string {
  return serializeQuadComponents(
    quad.subject,
    quad.predicate,
    quad.object,
    quad.graph,
  );
}

/**
 * Compares two RDF triples for equality.
 *
 * @param t1 the first triple.
 * @param t2 the second triple.
 *
 * @return true if the triples are the same, false if not.
 */
function _compareTriples(t1: Quad, t2: Quad): boolean {
  // compare subject and object types first as it is the quickest check
  if (
    !(t1.subject.termType === t2.subject.termType &&
      t1.object.termType === t2.object.termType)
  ) {
    return false;
  }
  // compare values
  if (
    !(t1.subject.value === t2.subject.value &&
      t1.predicate.value === t2.predicate.value &&
      t1.object.value === t2.object.value)
  ) {
    return false;
  }
  if (t1.object.termType !== TermType.LITERAL) {
    // no `datatype` or `language` to check
    return true;
  }
  return (
    (t1.object.datatype.termType ===
      (t2.object as LiteralTerm).datatype.termType) &&
    (t1.object.language === (t2.object as LiteralTerm).language) &&
    (t1.object.datatype.value === (t2.object as LiteralTerm).datatype.value)
  );
}

const _escapeRegex = /["\\\n\r]/g;
/**
 * Escape string to N-Quads literal
 */
function _escape(s: string): string {
  return s.replace(_escapeRegex, (match) => {
    switch (match) {
      case '"':
        return '\\"';
      case "\\":
        return "\\\\";
      case "\n":
        return "\\n";
      case "\r":
        return "\\r";
    }
    return match;
  });
}

const _unescapeRegex =
  /(?:\\([tbnrf"'\\]))|(?:\\u([0-9A-Fa-f]{4}))|(?:\\U([0-9A-Fa-f]{8}))/g;
/**
 * Unescape N-Quads literal to string
 */
function _unescape(s: string): string {
  return s.replace(_unescapeRegex, (match, code, u, U) => {
    if (code) {
      switch (code) {
        case "t":
          return "\t";
        case "b":
          return "\b";
        case "n":
          return "\n";
        case "r":
          return "\r";
        case "f":
          return "\f";
        case '"':
          return '"';
        case "'":
          return "'";
        case "\\":
          return "\\";
      }
    }
    if (u) {
      return String.fromCharCode(parseInt(u, 16));
    }
    if (U) {
      // FIXME: support larger values
      throw new Error("Unsupported U escape");
    }
    return match;
  });
}
