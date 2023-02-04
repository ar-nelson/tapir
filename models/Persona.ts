export interface Persona {
  readonly name: string;
  readonly displayName: string;
  readonly createdAt: string;
}

export interface PersonaStore {
  listPersonas(): Promise<readonly Persona[]>;
  getPersona(name: string): Promise<Persona | null>;
}

const MOCK_PERSONA: Persona = {
  name: "tapir",
  displayName: "tapir",
  createdAt: "2023-02-03T19:35:27-0500",
};

export class MockPersonaStore implements PersonaStore {
  async listPersonas(): Promise<readonly Persona[]> {
    return [MOCK_PERSONA];
  }
  async getPersona(name: string): Promise<Persona | null> {
    return name === "tapir" ? MOCK_PERSONA : null;
  }
}

export const personaStore = new MockPersonaStore();
