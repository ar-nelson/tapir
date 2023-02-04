// A simple dependency injection library for Tapir
// by Adam R. Nelson <adam@nels.onl>
// Loosely based on https://github.com/cmd-johnson/deno-dependency-injector

// deno-lint-ignore-file ban-types

import { Reflect } from "https://deno.land/x/reflect_metadata@v0.1.12/mod.ts";

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
    () => object
  >();

  constructor(
    private readonly overrides = new Map<
      Constructor | AbstractConstructor,
      Constructor
    >(),
  ) {}

  /**
   * Creates an instance of `Type` by calling its constructor with injected
   * arguments. `Type` does not have to be `@Injectable`.
   */
  inject<T extends object>(Type: Constructor<T>): T {
    if (this.isInjectable(Type)) {
      return this.resolve(Type);
    }
    return new Type(...this.getDependencies(Type).map(this.resolve.bind(this)));
  }

  /**
   * Creates or looks up an instance of the `@Injectable` class `Type`.
   */
  resolve<T extends object>(
    Type: Constructor<T> | AbstractConstructor<T>,
  ): T {
    if (this.resolved.has(Type)) {
      return this.resolved.get(Type)!() as T;
    }
    const option = this.getInjectionOptions(Type).find(({ injected }) =>
      this.hasDependencies(injected)
    );
    if (!option) {
      throw new TypeError(
        `Type ${Type.name} has no candidates available for dependency injection`,
      );
    }
    const deps = this.getDependencies(option.injected),
      resolve = this.resolve.bind(this),
      construct = () => new option.injected(...deps.map(resolve)),
      instance = construct();
    this.resolved.set(Type, option.isSingleton ? (() => instance) : construct);
    return instance;
  }

  private getInjectionOptions<T extends object>(
    Type: Constructor<T> | AbstractConstructor<T>,
  ): { readonly isSingleton: boolean; readonly injected: Constructor<T> }[] {
    if (this.overrides.has(Type)) {
      const Override = this.overrides.get(Type)! as Constructor<T>;
      const injected: InjectedMetadata<T> | undefined = Reflect.getOwnMetadata(
        INJECTED,
        Override,
      );
      return [{
        isSingleton: injected?.isSingleton ?? false,
        injected: Override,
      }];
    }
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
    return Reflect.getOwnMetadata("design:paramtypes", Type) || [];
  }

  private hasDependencies(Type: Constructor, history = [Type]): boolean {
    return this.resolved.has(Type) ||
      this.getDependencies(Type).every((Dep) => {
        if (history.includes(Dep)) {
          throw new Error(
            `Circular dependency in dependency injection for ${Type.name}: ${Dep.name}`,
          );
        }
        return this.resolved.has(Dep) ||
          this.getInjectionOptions(Dep).some(({ injected }) =>
            this.hasDependencies(injected, [Dep, ...history])
          );
      });
  }
}
