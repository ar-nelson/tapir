import { Singleton } from "$/lib/inject.ts";
import { generateKeyPair } from "$/lib/signatures.ts";
import { ProfileNotFound, RemoteProfileStore } from "$/models/RemoteProfile.ts";
import {
  KeyAlgorithm,
  ProtoAddr,
  protoAddrToString,
  Protocol,
  RemoteProfile,
  RemoteProfileFull,
  RemotePublicKey,
} from "$/models/types.ts";
import { LocalFetcher } from "$/services/RemoteFetcherService.ts";
import { REMOTE_PROFILES } from "./mock-data.ts";

@Singleton()
export class MockRemoteProfileStore extends RemoteProfileStore {
  readonly #keys = new Map<string, Promise<RemotePublicKey>>();

  constructor(private readonly localFetcher: LocalFetcher) {
    super();
  }

  async get(addr: ProtoAddr): Promise<RemoteProfileFull> {
    if (addr.protocol === Protocol.Local) {
      return this.localFetcher.fetchProfile(addr.path);
    }
    const addrString = protoAddrToString(addr),
      profile = (REMOTE_PROFILES as Record<string, RemoteProfile>)[addrString];
    if (!profile) {
      throw ProfileNotFound.error(`No mock profile at addr ${addrString}`);
    }
    const key = this.#keys.get(addrString) ?? (() => {
      const publicKey = generateKeyPair().then((keyPair) =>
        crypto.subtle.exportKey("spki", keyPair.publicKey)
      ).then((key) => ({
        name: addr.path + "#main-key",
        owner: addr,
        algorithm: KeyAlgorithm.RSA_SHA256,
        key: new Uint8Array(key),
      }));
      this.#keys.set(addrString, publicKey);
      return publicKey;
    })();
    return {
      ...profile,
      proxies: [],
      publicKeys: [await key],
      tags: [],
      emoji: [],
    };
  }

  upsert(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  update(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  delete(): Promise<void> {
    throw new Error("Method not implemented.");
  }
}
