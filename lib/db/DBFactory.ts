import {
  ColumnOf,
  ColumnsOf,
  DatabaseSpec,
  DB,
  DBLike,
  InRow,
  JoinChain,
  OrderDirection,
  OutRow,
  Query,
  TableOf,
} from "$/lib/sql/mod.ts";
import { Constructor } from "$/lib/inject.ts";

export abstract class AbstractDatabaseService<Spec extends DatabaseSpec>
  implements DB<Spec> {
  constructor() {
    throw new Error("do not extend AbstractDatabaseService directly");
  }

  abstract get<T extends TableOf<Spec>>(table: T, options?: {
    where?: Query<ColumnsOf<Spec, T>>;
    orderBy?: [ColumnOf<Spec, T>, OrderDirection][];
    limit?: number;
  }): AsyncIterable<OutRow<ColumnsOf<Spec, T>>>;

  abstract get<T extends TableOf<Spec>, Returned extends ColumnOf<Spec, T>>(
    table: T,
    options: {
      returning: Returned[];
      where?: Query<ColumnsOf<Spec, T>>;
      orderBy?: [ColumnOf<Spec, T>, OrderDirection][];
      limit?: number;
    },
  ): AsyncIterable<Pick<OutRow<ColumnsOf<Spec, T>>, Returned>>;

  abstract join<T extends TableOf<Spec>, Returned extends ColumnOf<Spec, T>>(
    options: {
      table: T;
      returning: Returned[];
      where?: Query<ColumnsOf<Spec, T>>;
      orderBy?: [ColumnOf<Spec, T>, OrderDirection][];
    },
  ): JoinChain<Spec, T, Pick<OutRow<ColumnsOf<Spec, T>>, Returned>>;

  abstract count<T extends TableOf<Spec>>(
    table: T,
    where: Query<ColumnsOf<Spec, T>>,
  ): Promise<number>;

  abstract insert<T extends TableOf<Spec>>(
    table: T,
    rows: InRow<ColumnsOf<Spec, T>>[],
  ): Promise<void>;

  abstract update<T extends TableOf<Spec>>(
    table: T,
    where: Query<ColumnsOf<Spec, T>>,
    fields: Partial<InRow<ColumnsOf<Spec, T>>>,
  ): Promise<number>;

  abstract delete<T extends TableOf<Spec>>(
    table: T,
    where: Query<ColumnsOf<Spec, T>>,
  ): Promise<number>;

  abstract transaction<R>(
    callback: (t: DBLike<Spec>) => Promise<R>,
  ): Promise<R>;

  abstract close(): Promise<void>;
}

export abstract class DBFactory {
  protected abstract construct<Spec extends DatabaseSpec>(
    spec: Spec,
  ): Constructor<DB<Spec>>;

  constructService<
    Spec extends DatabaseSpec,
    Service extends AbstractDatabaseService<Spec>,
  >(spec: Spec): Constructor<Service> {
    return this.construct(spec) as Constructor<Service>;
  }
}
