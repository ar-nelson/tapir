import { Constructor } from "$/lib/inject.ts";
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
  Tables,
} from "$/lib/sql/mod.ts";

export abstract class AbstractDatabaseService<Ts extends Tables>
  implements DB<Ts> {
  constructor() {
    throw new Error("do not extend AbstractDatabaseService directly");
  }

  abstract get<T extends TableOf<Ts>>(table: T, options?: {
    where?: Query<ColumnsOf<Ts, T>>;
    orderBy?: [ColumnOf<Ts, T>, OrderDirection][];
    limit?: number;
  }): AsyncIterable<OutRow<ColumnsOf<Ts, T>>>;

  abstract get<T extends TableOf<Ts>, Returned extends ColumnOf<Ts, T>>(
    table: T,
    options: {
      returning: Returned[];
      where?: Query<ColumnsOf<Ts, T>>;
      orderBy?: [ColumnOf<Ts, T>, OrderDirection][];
      limit?: number;
    },
  ): AsyncIterable<Pick<OutRow<ColumnsOf<Ts, T>>, Returned>>;

  abstract join<T extends TableOf<Ts>, Returned extends ColumnOf<Ts, T>>(
    options: {
      table: T;
      returning: Returned[];
      where?: Query<ColumnsOf<Ts, T>>;
      orderBy?: [ColumnOf<Ts, T>, OrderDirection][];
    },
  ): JoinChain<Ts, T, Pick<OutRow<ColumnsOf<Ts, T>>, Returned>>;

  abstract count<T extends TableOf<Ts>>(
    table: T,
    where: Query<ColumnsOf<Ts, T>>,
  ): Promise<number>;

  abstract insert<T extends TableOf<Ts>>(
    table: T,
    rows: InRow<ColumnsOf<Ts, T>>[],
  ): Promise<void>;

  abstract insert<T extends TableOf<Ts>, Returned extends ColumnOf<Ts, T>>(
    table: T,
    rows: InRow<ColumnsOf<Ts, T>>[],
    returning: Returned[],
  ): Promise<Pick<OutRow<ColumnsOf<Ts, T>>, Returned>[]>;

  abstract update<T extends TableOf<Ts>>(
    table: T,
    where: Query<ColumnsOf<Ts, T>>,
    fields: Partial<InRow<ColumnsOf<Ts, T>>>,
  ): Promise<number>;

  abstract delete<T extends TableOf<Ts>>(
    table: T,
    where: Query<ColumnsOf<Ts, T>>,
  ): Promise<number>;

  abstract transaction<R>(
    callback: (t: DBLike<Ts>) => Promise<R>,
  ): Promise<R>;

  abstract close(): Promise<void>;
}

export abstract class DBFactory {
  protected abstract construct<Ts extends Tables>(
    spec: DatabaseSpec<Ts>,
  ): Constructor<DB<Ts>>;

  constructService<
    Ts extends Tables,
    Service extends AbstractDatabaseService<Ts>,
  >(spec: DatabaseSpec<Ts>): Constructor<Service> {
    return this.construct(spec) as Constructor<Service>;
  }
}
