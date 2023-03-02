export interface Repo extends AsyncIterable<string> {
  get(hash: string): Promise<Uint8Array | null>;
  has(hash: string): Promise<boolean>;
  put(data: Uint8Array): Promise<string>;
  delete(hash: string): Promise<void>;
  clear(): Promise<void>;
}
