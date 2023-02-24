export type DatabaseValues =
  | string
  | number
  | Date
  | boolean
  | Uint8Array
  | null
  | undefined;

export enum QueryOperator {
  In = "IN",
  NotIn = "NOT IN",
  Between = "BETWEEN",
  NotBetween = "NOT BETWEEN",
  Like = "LIKE",
  NotLike = "NOT LIKE",
  Ilike = "ILIKE",
  NotIlike = "ILIKE",
  Equal = "=",
  NotEqual = "!=",
  GreaterThan = ">",
  GreaterThanEqual = ">=",
  LowerThan = "<",
  LowerThanEqual = "<=",
  Null = "IS NULL",
  NotNull = "IS NOT NULL",
}

/** Query expression builder */
export class Q<T extends DatabaseValues = DatabaseValues> {
  constructor(
    public operator: QueryOperator,
    public value: T | T[],
  ) {}

  // --------------------------------------------------------------------------------
  // GENERIC
  // --------------------------------------------------------------------------------

  /** The value is one of the given values */
  public static in<T extends DatabaseValues>(values: T[]): Q<T> {
    return new Q(QueryOperator.In, values);
  }

  /** The value is not one of the given values */
  public static notIn<T extends DatabaseValues>(values: T[]): Q<T> {
    return new Q(QueryOperator.NotIn, values);
  }

  /** The value (number) is between these numbers */
  public static between(value1: number, value2: number): Q<number> {
    return new Q(QueryOperator.Between, [value1, value2]);
  }

  /** The value (number) is between these numbers */
  public static notBetween(value1: number, value2: number): Q<number> {
    return new Q(QueryOperator.NotBetween, [value1, value2]);
  }

  /** LIKE operator */
  public static like(value: string): Q<string> {
    return new Q(QueryOperator.Like, value);
  }

  /** NOT LIKE operator */
  public static notLike(value: string): Q<string> {
    return new Q(QueryOperator.NotLike, value);
  }

  /** ILIKE (case-insensitive) operator */
  public static ilike(value: string): Q<string> {
    return new Q(QueryOperator.Ilike, value);
  }

  /** NOT ILIKE (case-insensitive) operator */
  public static notIlike(value: string): Q<string> {
    return new Q(QueryOperator.NotIlike, value);
  }
  // --------------------------------------------------------------------------------
  // NUMERIC
  // --------------------------------------------------------------------------------

  /** Is equal to (=) */
  public static eq<T extends DatabaseValues>(value: T): Q<T> {
    return new Q(QueryOperator.Equal, value);
  }

  /** Is not equal to (!=) */
  public static neq<T extends DatabaseValues>(value: T): Q<T> {
    return new Q(QueryOperator.NotEqual, value);
  }

  /** Greater than (>) */
  public static gt<T extends DatabaseValues>(value: T): Q<T> {
    return new Q(QueryOperator.GreaterThan, value);
  }

  /** Greater than equal (>=) */
  public static gte<T extends DatabaseValues>(value: T): Q<T> {
    return new Q(QueryOperator.GreaterThanEqual, value);
  }

  /** Lower than (<) */
  public static lt<T extends DatabaseValues>(value: T): Q<T> {
    return new Q(QueryOperator.LowerThan, value);
  }

  /** Lower than equal (<=) */
  public static lte<T extends DatabaseValues>(value: T): Q<T> {
    return new Q(QueryOperator.LowerThanEqual, value);
  }

  // --------------------------------------------------------------------------------
  // NULL
  // --------------------------------------------------------------------------------

  /** The value is null */
  public static null(): Q<null> {
    return new Q(QueryOperator.Null, null);
  }

  /** The value is not null */
  public static notNull(): Q<null> {
    return new Q(QueryOperator.NotNull, null);
  }
}
