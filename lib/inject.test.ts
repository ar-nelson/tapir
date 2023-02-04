import {
  Injectable,
  InjectableAbstract,
  Injector,
  Singleton,
} from "./inject.ts";
import { assertEquals } from "https://deno.land/std@0.176.0/testing/asserts.ts";

@InjectableAbstract()
abstract class Increment {
  abstract inc(n: number): number;
}

@Singleton(Increment)
class IncrementBy1 extends Increment {
  inc(n: number) {
    return n + 1;
  }
}

class IncrementBy2 extends Increment {
  inc(n: number) {
    return n + 2;
  }
}

@Injectable()
class IncrementMutable extends Increment {
  private mutable = 1;

  inc(n: number) {
    return n + (this.mutable++);
  }
}

@Singleton()
class IncrementMutableSingleton extends Increment {
  private mutable = 1;

  inc(n: number) {
    return n + (this.mutable++);
  }
}

@Injectable()
class Baz {
  n: number;

  constructor(inc: Increment) {
    this.n = inc.inc(1);
  }
}

@Injectable()
class Bar {
  n: number;

  constructor(baz: Baz, inc: Increment) {
    this.n = inc.inc(baz.n);
  }
}

@Injectable()
class Foo {
  n: number;

  constructor(bar: Bar, inc: Increment) {
    this.n = inc.inc(bar.n);
  }
}

Deno.test("Inject copies", () => {
  const injector = new Injector();
  const inc1 = injector.resolve(IncrementMutable),
    inc2 = injector.resolve(IncrementMutable);
  assertEquals(inc1.inc(1), 2);
  assertEquals(inc1.inc(1), 3);
  assertEquals(inc2.inc(1), 2);
});

Deno.test("Inject singleton", () => {
  const injector = new Injector();
  const inc1 = injector.resolve(IncrementMutableSingleton),
    inc2 = injector.resolve(IncrementMutableSingleton);
  assertEquals(inc1.inc(1), 2);
  assertEquals(inc1.inc(1), 3);
  assertEquals(inc2.inc(1), 4);
});

Deno.test("Inject abstract", () => {
  const inc = new Injector().resolve(Increment);
  assertEquals(inc.inc(2), 3);
});

Deno.test("Inject abstract override", () => {
  const inc = new Injector(new Map([[Increment, IncrementBy2]])).resolve(
    Increment,
  );
  assertEquals(inc.inc(2), 4);
});

Deno.test("Inject subclass", () => {
  const inc = new Injector().resolve(IncrementBy1);
  assertEquals(inc.inc(2), 3);
});

Deno.test("Inject transitive", () => {
  const foo = new Injector().resolve(Foo);
  assertEquals(foo.n, 4);
});
