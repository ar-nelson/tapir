import {
  ColumnInValue,
  ColumnOutValue,
  Columns,
  ColumnSpec,
  ColumnType,
  inToOut,
  OutRow,
  Query,
} from "./DB.ts";
import { DatabaseValues, Q, QueryOperator } from "./Q.ts";
import { OrderDirection } from "./QueryBuilder.ts";

export type Comparator<C extends ColumnSpec<ColumnType>> = (
  a: ColumnOutValue<C>,
  b: ColumnOutValue<C>,
) => number;

export type RowComparator<C extends Columns> = (
  a: OutRow<C>,
  b: OutRow<C>,
) => number;

export function columnCompare<C extends ColumnSpec<ColumnType>>(
  spec: C,
  order: OrderDirection = "ASC",
): Comparator<C> {
  if (spec.nullable) {
    const nonNullable = columnCompare({ ...spec, nullable: false }, order);
    return (a, b) =>
      a == null ? (b == null ? 0 : -1) : b == null ? 1 : nonNullable(a, b);
  }
  let comparator: Comparator<C>;
  switch (spec.type) {
    case ColumnType.Ulid:
    case ColumnType.String:
      comparator = ((a: string, b: string) => a.localeCompare(b)) as Comparator<
        C
      >;
      break;
    case ColumnType.Integer:
      comparator = ((a: number, b: number) => a - b) as Comparator<C>;
      break;
    case ColumnType.Boolean:
      comparator =
        ((a: boolean, b: boolean) => (a ? 1 : 0) - (b ? 1 : 0)) as Comparator<
          C
        >;
      break;
    case ColumnType.Date:
      comparator =
        ((a: Date, b: Date) => a.valueOf() - b.valueOf()) as Comparator<C>;
      break;
    default:
      throw new TypeError(
        "Tried to compare a database column type that is not comparable",
      );
  }
  if (order === "DESC") {
    return (a, b) => -comparator(a, b);
  }
  return comparator;
}

export function rowCompare<C extends Columns>(
  spec: C,
  column: keyof C & string,
  order: OrderDirection = "ASC",
): RowComparator<C> {
  const cmp = columnCompare(spec[column], order);
  return (a, b) => cmp(a[column], b[column]);
}

function like(pattern: string, value: string): boolean {
  if (pattern.startsWith("%")) {
    if (pattern.endsWith("%")) {
      return value.includes(pattern.slice(1, pattern.length - 1));
    }
    return value.endsWith(pattern.slice(1));
  } else if (pattern.endsWith("%")) {
    return value.startsWith(pattern.slice(0, pattern.length - 1));
  }
  return pattern == value;
}

export function columnQuery<C extends ColumnSpec<ColumnType>>(
  spec: C,
  q: Q<ColumnInValue<C> & DatabaseValues>,
): (actual: ColumnOutValue<C>) => boolean {
  const { value, operator } = q;
  if (Array.isArray(value)) {
    switch (operator) {
      case QueryOperator.In:
        return (actual) =>
          value.includes(actual as ColumnInValue<C> & DatabaseValues);
      case QueryOperator.NotIn:
        return (actual) =>
          !value.includes(actual as ColumnInValue<C> & DatabaseValues);
      case QueryOperator.Between: {
        const lo = +(value[0] ?? 0), hi = +(value[1] ?? 0);
        return (actual) => (actual as number) < hi && (actual as number) > lo;
      }
      case QueryOperator.NotBetween: {
        const lo = +(value[0] ?? 0), hi = +(value[1] ?? 0);
        return (actual) => (actual as number) >= hi || (actual as number) <= lo;
      }
      default:
        throw new TypeError(
          `The ${operator} operation is not valid for arrays`,
        );
    }
  } else {
    const expected = inToOut(spec, value, false);
    switch (operator) {
      case QueryOperator.Equal:
        return (actual) => actual === expected;
      case QueryOperator.NotEqual:
        return (actual) => actual !== expected;
      case QueryOperator.Null:
        return (actual) => actual == null;
      case QueryOperator.NotNull:
        return (actual) => actual != null;
      case QueryOperator.Like:
        if (spec.type !== ColumnType.String) {
          throw new TypeError(
            "The Like query operation is only valid for String columns",
          );
        }
        return (actual) => like(expected as string, actual as string);
      case QueryOperator.NotLike:
        if (spec.type !== ColumnType.String) {
          throw new TypeError(
            "The NotLike query operation is only valid for String columns",
          );
        }
        return (actual) => !like(expected as string, actual as string);
      case QueryOperator.Ilike:
        if (spec.type !== ColumnType.String) {
          throw new TypeError(
            "The Ilike query operation is only valid for String columns",
          );
        }
        return (actual) =>
          like(
            (expected as string).toLowerCase(),
            (actual as string).toLowerCase(),
          );
      case QueryOperator.NotIlike:
        if (spec.type !== ColumnType.String) {
          throw new TypeError(
            "The NotIlike query operation is only valid for String columns",
          );
        }
        return (actual) =>
          !like(
            (expected as string).toLowerCase(),
            (actual as string).toLowerCase(),
          );
      case QueryOperator.In:
      case QueryOperator.NotIn:
      case QueryOperator.Between:
      case QueryOperator.NotBetween:
        throw new TypeError(
          `The ${operator} operation is only valid for arrays`,
        );
      default: {
        const comparator = columnCompare(spec);
        switch (operator) {
          case QueryOperator.LowerThan:
            return (actual) => comparator(actual, expected) < 0;
          case QueryOperator.LowerThanEqual:
            return (actual) => comparator(actual, expected) <= 0;
          case QueryOperator.GreaterThan:
            return (actual) => comparator(actual, expected) > 0;
          case QueryOperator.GreaterThanEqual:
            return (actual) => comparator(actual, expected) >= 0;
        }
      }
    }
  }
}

export function rowQuery<C extends Columns>(spec: C, query: Query<C>) {
  return (Object.entries(query) as [
    keyof C & string,
    | (ColumnInValue<C[keyof C]> & DatabaseValues)
    | Q<ColumnInValue<C[keyof C]> & DatabaseValues>,
  ][]).reduce(
    (fn, [k, q]) => {
      const c = columnQuery(
        spec[k],
        q instanceof Q ? q : new Q(QueryOperator.Equal, q),
      );
      return (row: OutRow<C>) => c(row[k]) && fn(row);
    },
    (_row: OutRow<C>) => true,
  );
}
