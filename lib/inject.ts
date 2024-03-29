// A simple dependency injection library for Tapir
// by Adam R. Nelson <adam@nels.onl>
// Loosely based on https://github.com/cmd-johnson/deno-dependency-injector

// deno-lint-ignore-file ban-types

import { Reflect } from "reflect";

const INJECTABLE = "dependencyInjection:injectable";
const INJECTED = "dependencyInjection:injected";

export type Constructor<T extends object = object> = new (
  // deno-lint-ignore no-explicit-any
  ...args: any[]
) => T;

export type AbstractConstructor<T extends object = object> = abstract new (
  // deno-lint-ignore no-explicit-any
  ...args: any[]
) => T;

/**
 * A special type of constructor that can be inserted into the `overrides` map
 * of an `Injector`. It makes the injection of one type dependent on other
 * types, by first constructing a `ConditionalResolver` with the available
 * properties, then injecting the result of that resolver's `resolve` method.
 */
export abstract class ConditionalResolver<T extends object> {
  abstract resolve(): Promise<Constructor<T>>;
  isSingleton = false;
}

interface InjectableMetadata<T extends object> {
  readonly classes: readonly Constructor<T>[];
}

interface InjectedMetadata<T extends object> {
  readonly forClass: Constructor<T> | AbstractConstructor<T>;
  readonly isSingleton: boolean;
}

function setInjectionMetadata<T extends object>(
  Type: Constructor<T>,
  metadata: InjectedMetadata<T>,
) {
  const existingMetadata = Reflect.getOwnMetadata(
    INJECTABLE,
    metadata.forClass,
  );
  Reflect.defineMetadata(INJECTABLE, {
    classes: [...existingMetadata?.classes ?? [], Type],
  }, metadata.forClass);
  Reflect.defineMetadata(INJECTED, metadata, Type);
  if (Type !== metadata.forClass) {
    const existingMetadata = Reflect.getOwnMetadata(
      INJECTABLE,
      Type,
    );
    Reflect.defineMetadata(INJECTABLE, {
      classes: [...existingMetadata?.classes ?? [], Type],
    }, Type);
  }
}

/**
 * Marks an abstract class as injectable, but does not provide an instance to
 * inject. For injection to work, another class must be marked `@Injectable` or
 * `@Singleton` and take the decorated abstract class as a parameter.
 */
export function InjectableAbstract<T extends object>() {
  return (Type: AbstractConstructor<T>): void => {
    if (!Reflect.hasOwnMetadata(INJECTABLE, Type)) {
      Reflect.defineMetadata(INJECTABLE, { classes: [] }, Type);
    }
  };
}

/**
 * Marks a class as injectable. Its constructor will be called with injected
 * arguments every time an instance is injected.
 *
 * If passed a constructor of a superclass, the class will also be injectable
 * as an instance of that superclass.
 */
export function Injectable<T extends object>(
  forClass?: Constructor<T> | AbstractConstructor<T>,
) {
  return (Type: Constructor<T>): void => {
    setInjectionMetadata(Type, {
      forClass: forClass ?? Type,
      isSingleton: false,
    });
  };
}

/**
 * Marks a class as injectable, and ensures that only one injected instance of
 * the class exists. The singleton instance will be reused every time the class
 * is injected.
 *
 * If passed a constructor of a superclass, the class will also be injectable
 * as an instance of that superclass.
 */
export function Singleton<T extends object>(
  forClass?: Constructor<T> | AbstractConstructor<T>,
) {
  return (Type: Constructor<T>): void => {
    setInjectionMetadata(Type, {
      forClass: forClass ?? Type,
      isSingleton: true,
    });
  };
}

/**
 * Looks up dependencies of `@Injectable` classes and creates instances of these
 * classes and their dependencies. The entry points are `resolve` and `inject`.
 */
export class Injector {
  private readonly resolved = new Map<
    Constructor | AbstractConstructor,
    () => Promise<object>
  >([[Injector, () => Promise.resolve(this)]]);

  constructor(
    ...overrides:
      readonly (readonly [Constructor | AbstractConstructor, Constructor])[]
  ) {
    for (const [Dep, Ctor] of overrides) {
      const injected: InjectedMetadata<object> | undefined = Reflect
        .getOwnMetadata(
          INJECTED,
          Ctor,
        );
      if (injected?.isSingleton) {
        let instance: Promise<object> | null = null;
        this.resolved.set(
          Dep,
          () => instance ?? (instance = this.inject(Ctor)),
        );
      } else {
        this.resolved.set(Dep, () => this.inject(Ctor));
      }
    }
  }

  /**
   * Creates an instance of `Type` by calling its constructor with injected
   * arguments. `Type` does not have to be `@Injectable`.
   */
  async inject<T extends object>(Type: Constructor<T>): Promise<T> {
    if (this.isInjectable(Type)) {
      return this.resolve(Type);
    }
    return new Type(
      ...await Promise.all(
        this.getDependencies(Type).map((d) => this.resolve(d)),
      ),
    );
  }

  async #resolve<T extends object>(
    isSingleton: boolean,
    Type: Constructor<T> | AbstractConstructor<T>,
    Injected: Constructor<T>,
    history: (Constructor | AbstractConstructor)[],
  ): Promise<{ instance: T; ctor: () => Promise<T> }> {
    const deps = this.getDependencies(Injected),
      resolve = this.resolve.bind(this),
      newHistory = [...history, Type];
    let construct = async () =>
        new Injected(
          ...await Promise.all(deps.map((d) => resolve(d, newHistory))),
        ),
      instance = await construct();
    while (instance instanceof ConditionalResolver) {
      const i = instance,
        constructParent = isSingleton
          ? (() => Promise.resolve(i))
          : construct as () => Promise<ConditionalResolver<T>>;
      isSingleton = instance.isSingleton;
      const ctor = await instance.resolve(),
        deps = this.getDependencies(ctor);
      construct = async () =>
        new (await (await constructParent()).resolve())(
          ...await Promise.all(deps.map((d) => resolve(d, newHistory))),
        );
      instance = await construct();
    }
    return {
      instance,
      ctor: isSingleton ? () => Promise.resolve(instance) : construct,
    };
  }

  /**
   * Creates or looks up an instance of the `@Injectable` class `Type`.
   */
  resolve<T extends object>(
    Type: Constructor<T> | AbstractConstructor<T>,
    history: (Constructor | AbstractConstructor)[] = [],
  ): Promise<T> {
    if (this.resolved.has(Type)) {
      return this.resolved.get(Type)!() as Promise<T>;
    }
    if (history.includes(Type)) {
      throw new Error(`Recursion in dependency injection: ${Type.name}`);
    }
    const optionsOrMissing = this.getInjectionOptions(Type).map((opt) =>
        [opt, this.missingDependencies(opt.injected)] as const
      ),
      option = optionsOrMissing.find(([, missing]) => !missing.length)?.[0];
    if (option == null) {
      const missing = optionsOrMissing.filter(([, missing]) => missing.length)
        .map((x) => x[1]);
      throw new TypeError(
        `Type ${Type.name} has no candidates available for dependency injection.
Missing dependencies: ${
          missing.map((x) => "(" + [...new Set(x)].join(", ") + ")").join(
            " or ",
          )
        }`,
      );
    }
    return new Promise((resolveInstance, rejectInstance) => {
      const ctor = new Promise<() => Promise<T>>((resolveCtor, rejectCtor) => {
        this.resolved.set(Type, () => ctor.then((x) => x()));
        this.#resolve(option.isSingleton, Type, option.injected, history).then(
          ({ instance, ctor }) => {
            resolveCtor(ctor);
            resolveInstance(instance);
          },
          (e) => {
            rejectCtor(e);
            rejectInstance(e);
          },
        );
      });
    });
  }

  private getInjectionOptions<T extends object>(
    Type: Constructor<T> | AbstractConstructor<T>,
  ): { readonly isSingleton: boolean; readonly injected: Constructor<T> }[] {
    const injectable: InjectableMetadata<T> | undefined = Reflect
      .getOwnMetadata(INJECTABLE, Type);
    if (!injectable) {
      throw new TypeError(`Type ${Type.name} is not injectable`);
    }
    return injectable.classes.map((c) => {
      const injected: InjectedMetadata<T> | undefined = Reflect.getOwnMetadata(
        INJECTED,
        c,
      );
      if (!injected) {
        throw new TypeError(
          `Type ${c.name} is not available for dependency injection`,
        );
      }
      return { ...injected, injected: c };
    });
  }

  isInjectable(Type: Constructor): boolean {
    return typeof Reflect.getOwnMetadata(INJECTABLE, Type) === "object";
  }

  private getDependencies(Type: Constructor): Constructor[] {
    const meta = Reflect.getOwnMetadata("design:paramtypes", Type);
    if (meta == null && Type.length > 0) {
      throw new TypeError(
        `Cannot inject dependencies of constructor ${Type.name}: no paramtypes metadata.
Did you forget @Injectable?`,
      );
    }
    return meta || [];
  }

  private missingDependencies(Type: Constructor, history = [Type]): string[] {
    if (this.resolved.has(Type)) return [];
    return this.getDependencies(Type).flatMap((Dep) => {
      if (history.includes(Dep)) {
        throw new Error(
          `Circular dependency in dependency injection for ${Type.name}: ${Dep.name}`,
        );
      }
      if (this.resolved.has(Dep)) return [];
      const options = this.getInjectionOptions(Dep).map(({ injected }) =>
        this.missingDependencies(injected, [Dep, ...history])
      );
      if (options.some((o) => !o.length)) return [];
      return [Dep.name, ...options[0] ?? []];
    });
  }
}
