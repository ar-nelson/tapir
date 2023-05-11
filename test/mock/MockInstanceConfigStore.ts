import { base64 } from "$/deps.ts";
import {
  InstanceConfig,
  InstanceConfigStore,
} from "$/models/InstanceConfig.ts";

export const MOCK_INSTANCE_CONFIG: InstanceConfig = {
  initialized: true,
  displayName: "Tapir Test",
  summary: "mock tapir server",
  loginName: "tapir",
  passwordHash: base64.decode("N63CXrwv0u0U7ziMTLeHh6/Qg/qoXpAB4jyzqFtmttM="), // password: "iamatapir"
  passwordSalt: base64.decode("EtVFrF66Kt11z9g10fERFg=="),
  mediaSalt: base64.decode("AAAAAAAA"),
  locale: "en-US",
  adminEmail: "admin@example.com",
  maxCharacters: 65536,
  maxMediaAttachments: 32,
  maxImageBytes: 1024 * 1024 * 16,
  maxImagePixels: 3840 * 2160,
  maxVideoBytes: 1024 * 1024 * 256,
  maxVideoPixels: 1920 * 1080,
  maxVideoFramerate: 60,
  updatedAt: new Date(),
};

export class MockInstanceConfigStore extends InstanceConfigStore {
  #config = MOCK_INSTANCE_CONFIG;

  get() {
    return Promise.resolve(this.#config);
  }

  update() {
    return Promise.reject(
      new Error("update is not implemented in MockInstanceConfigStore"),
    );
  }
}
