import { assertEquals } from "$/deps.ts";
import {
  ConditionalResolver,
  Injectable,
  InjectableAbstract,
  Injector,
  Singleton,
} from "$/lib/inject.ts";

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

@Injectable()
class Condition {
  constructor() {}

  value() {
    return 2;
  }
}

@Injectable()
class ConditionalIncrement extends ConditionalResolver<Increment> {
  constructor(private readonly c: Condition) {
    super();
  }
  resolve() {
    return Promise.resolve(
      this.c.value() == 1 ? IncrementBy1 : IncrementBy2,
    );
  }
}

Deno.test("Inject copies", async () => {
  const injector = new Injector();
  const inc1 = await injector.resolve(IncrementMutable),
    inc2 = await injector.resolve(IncrementMutable);
  assertEquals(inc1.inc(1), 2);
  assertEquals(inc1.inc(1), 3);
  assertEquals(inc2.inc(1), 2);
});

Deno.test("Inject singleton", async () => {
  const injector = new Injector();
  const inc1 = await injector.resolve(IncrementMutableSingleton),
    inc2 = await injector.resolve(IncrementMutableSingleton);
  assertEquals(inc1.inc(1), 2);
  assertEquals(inc1.inc(1), 3);
  assertEquals(inc2.inc(1), 4);
});

Deno.test("Inject abstract", async () => {
  const inc = await new Injector().resolve(Increment);
  assertEquals(inc.inc(2), 3);
});

Deno.test("Inject abstract override", async () => {
  const inc = await new Injector([Increment, IncrementBy2]).resolve(
    Increment,
  );
  assertEquals(inc.inc(2), 4);
});

Deno.test("Inject subclass", async () => {
  const inc = await new Injector().resolve(IncrementBy1);
  assertEquals(inc.inc(2), 3);
});

Deno.test("Inject transitive", async () => {
  const foo = await new Injector().resolve(Foo);
  assertEquals(foo.n, 4);
});

Deno.test("Inject conditional", async () => {
  const injector = new Injector([Increment, ConditionalIncrement]);
  const inc = await injector.resolve(Increment);
  assertEquals(inc.inc(1), 3);
});
