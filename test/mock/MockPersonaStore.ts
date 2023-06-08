import { Singleton } from "$/lib/inject.ts";
import { PersonaNotFound, PersonaStore } from "$/models/Persona.ts";
import { MockPersonaName, PERSONAS } from "./mock-data.ts";

@Singleton()
export class MockPersonaStore extends PersonaStore {
  async *list() {
    yield* Object.values(PERSONAS);
  }

  count() {
    return Promise.resolve(Object.values(PERSONAS).length);
  }

  getMain() {
    return Promise.resolve(Object.values(PERSONAS).find((it) => it.main)!);
  }

  get(name: string) {
    const persona = PERSONAS[name as MockPersonaName];
    return persona ? Promise.resolve(persona) : Promise.reject(
      PersonaNotFound.error(`No persona named ${JSON.stringify(name)}`),
    );
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
