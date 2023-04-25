/*
 * Based on https://github.com/digitalbazaar/rdf-canonize
 * Original code (c) 2016-2022 Digital Bazaar, Inc.; BSD licensed
 */

export interface MessageDigest {
  update(msg: string): void;
  digest(): Promise<string>;
}

export class WebCryptoMessageDigest implements MessageDigest {
  #content = "";

  /**
   * Creates a new WebCrypto API MessageDigest.
   *
   * @param algorithm the algorithm to use.
   */
  constructor(public readonly algorithm: string) {
    if (algorithm !== "SHA-256") {
      throw new Error(`Unsupported algorithm "${algorithm}".`);
    }
  }

  update(msg: string) {
    this.#content += msg;
  }

  async digest() {
    const data = new TextEncoder().encode(this.#content);
    const buffer = await crypto.subtle.digest({ name: this.algorithm }, data);
    return bufferToHex(buffer);
  }
}

// precompute byte to hex table
const byteToHex: string[] = [];
for (let n = 0; n <= 0xff; ++n) {
  byteToHex.push(n.toString(16).padStart(2, "0"));
}

function bufferToHex(buffer: ArrayBufferLike) {
  let hex = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; ++i) {
    hex += byteToHex[bytes[i]];
  }
  return hex;
}
