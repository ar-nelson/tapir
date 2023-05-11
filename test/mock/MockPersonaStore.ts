import { PersonaNotFound, PersonaStore } from "$/models/Persona.ts";
import { Persona, ProfileType } from "$/models/types.ts";

const MOCK_PERSONA: Persona = {
  name: "tapir",
  displayName: "tapir",
  type: ProfileType.Person,
  summary: "look at me. i'm the fediverse now.",
  requestToFollow: true,
  createdAt: new Date("2023-02-03T19:35:27-0500"),
  main: true,
};

export class MockPersonaStore extends PersonaStore {
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
    if (name !== "tapir") {
      throw PersonaNotFound.error(`No persona named ${JSON.stringify(name)}`);
    }
    return Promise.resolve(MOCK_PERSONA);
  }

  create(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  update(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  delete(): Promise<void> {
    throw new Error("Method not implemented.");
  }
}
