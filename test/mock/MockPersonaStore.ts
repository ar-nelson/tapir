import {
  Persona,
  PersonaStoreReadOnly,
} from "$/models/PersonaStoreReadOnly.ts";
import { generateKeyPair } from "$/lib/signatures.ts";

const MOCK_PERSONA: Persona = {
  name: "tapir",
  displayName: "tapir",
  summary: "look at me. i'm the fediverse now.",
  requestToFollow: true,
  createdAt: new Date("2023-02-03T19:35:27-0500"),
  main: true,
};

export class MockPersonaStore extends PersonaStoreReadOnly {
  #keyPair = generateKeyPair();

  async *list() {
    yield MOCK_PERSONA;
  }

  count() {
    return Promise.resolve(1);
  }

  getMain() {
    return Promise.resolve(MOCK_PERSONA);
  }

  get(name: string) {
    return Promise.resolve(name === "tapir" ? MOCK_PERSONA : null);
  }

  async publicKey() {
    return (await this.#keyPair).publicKey;
  }

  async privateKey() {
    return (await this.#keyPair).privateKey;
  }
}
