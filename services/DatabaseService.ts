import { Constructor, InjectableAbstract } from "$/lib/inject.ts";
import {
  ColumnOf,
  ColumnsOf,
  DatabaseSpec,
  DB,
  InRow,
  JoinChain,
  OrderDirection,
  OutRow,
  Query,
  TableOf,
} from "$/lib/sql/mod.ts";

export abstract class DatabaseServiceFactory {
  abstract init<Spec extends DatabaseSpec>(
    spec: Spec,
  ): Promise<Constructor<DatabaseService<Spec>>>;
}

@InjectableAbstract()
export abstract class DatabaseService<Spec extends DatabaseSpec>
  implements DB<Spec> {
  abstract get<T extends TableOf<Spec>>(table: T, options?: {
    where?: Query<ColumnsOf<Spec, T>>;
    orderBy?: [ColumnOf<Spec, T>, OrderDirection][];
    limit?: number;
  }): AsyncIterable<OutRow<ColumnsOf<Spec, T>>>;

  abstract get<
    T extends TableOf<Spec>,
    Returned extends ColumnOf<Spec, T>,
  >(table: T, options: {
    returning: Returned[];
    where?: Query<ColumnsOf<Spec, T>>;
    orderBy?: [ColumnOf<Spec, T>, OrderDirection][];
    limit?: number;
  }): AsyncIterable<Pick<OutRow<ColumnsOf<Spec, T>>, Returned>>;

  abstract join<
    T extends TableOf<Spec>,
    Returned extends ColumnOf<Spec, T>,
  >(options: {
    table: T;
    returning: Returned[];
    where?: Query<ColumnsOf<Spec, T>>;
    orderBy?: [ColumnOf<Spec, T>, OrderDirection][];
  }): JoinChain<Spec, T, Pick<OutRow<ColumnsOf<Spec, T>>, Returned>>;

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

  abstract transaction<R>(callback: (t: DB<Spec>) => Promise<R>): Promise<R>;

  abstract close(): Promise<void>;
}
