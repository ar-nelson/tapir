import { InjectableAbstract, Singleton } from "$/lib/inject.ts";

export interface Persona {
  readonly name: string;
  readonly displayName: string;
  readonly createdAt: string;
}

@InjectableAbstract()
export abstract class PersonaStore {
  abstract listPersonas(): Promise<readonly Persona[]>;
  abstract getPersona(name: string): Promise<Persona | null>;
}

const MOCK_PERSONA: Persona = {
  name: "tapir",
  displayName: "tapir",
  createdAt: "2023-02-03T19:35:27-0500",
};

@Singleton(PersonaStore)
export class MockPersonaStore extends PersonaStore {
  async listPersonas() {
    return [MOCK_PERSONA];
  }
  async getPersona(name: string) {
    return name === "tapir" ? MOCK_PERSONA : null;
  }
}
