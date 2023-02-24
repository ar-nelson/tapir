import {
  JoinType,
  QueryDescription,
  QueryType,
  WhereBinding,
  WhereType,
} from "./QueryBuilder.ts";
import { DatabaseValues, QueryOperator } from "./Q.ts";
import { DBDialects } from "./TypeUtils.ts";
import { toHex } from "$/lib/utils.ts";

/**
 * Wrap a table or column name with backticks or
 * double quotes depending on the database dialect.
 *
 * @param name the table or column name to be wrapped
 * @param dialect the database dialect
 */
export function quote(name: string, dialect: DBDialects): string {
  if (name === "*") {
    return name;
  }

  switch (dialect) {
    case "pg":
      return `"${name}"`;
    case "mysql":
    case "sqlite3":
    default:
      return `\`${name}\``;
  }
}

/**
 * Format Date object to be "YYYY-MMMM-DD HH:mm:ss" string
 *
 * @param date The date will be formatted
 */
export function formatDate(date: Date): string {
  // Format date to be "YYYY-MM-DD"
  const dateString = formatZerolessValue(date.getFullYear()) + "-" +
    formatZerolessValue(date.getMonth() + 1) + "-" +
    formatZerolessValue(date.getDate());

  // Format date time to be "HH:mm:ss"
  const timeString = formatZerolessValue(date.getHours()) +
    ":" + formatZerolessValue(date.getMinutes()) +
    ":" + formatZerolessValue(date.getSeconds());

  return `${dateString} ${timeString}`;
}

/**
 * Formats given number to "0x" format, e.g. if it is 1 then it will return "01".
 *
 * @param value the number which will be formatted
 */
function formatZerolessValue(value: number): string {
  return `${value}`.padStart(2, "0");
}

/**
 * Remove duplicate column names in an array.
 */
export function uniqueColumnNames<T>(columns: T[]): T[] {
  const a = columns.concat();

  for (let i = 0; i < a.length; ++i) {
    for (let j = i + 1; j < a.length; ++j) {
      const left = a[i];
      const right = a[j];

      if (left === right) {
        a.splice(j--, 1);
      } else if (
        (Array.isArray(left) && Array.isArray(right)) &&
        left[1] === right[1]
      ) {
        a.splice(j--, 1);
      }
    }
  }

  return a;
}

/**
 * Transform QueryDescription to an executable SQL query string
 */
export class QueryCompiler {
  private values: DatabaseValues[] = [];

  constructor(
    private description: QueryDescription,
    private dialect: DBDialects,
  ) {}

  /**
   * Generate executable SQL statement
   */
  public compile(): { text: string; values: DatabaseValues[] } {
    let query: string;

    switch (this.description.type) {
      case QueryType.Insert:
        query = this.toInsertSQL();
        break;
      case QueryType.Replace:
        query = this.toInsertSQL(true);
        break;
      case QueryType.Update:
        query = this.toUpdateSQL();
        break;
      case QueryType.Delete:
        query = this.toDeleteSQL();
        break;
      case QueryType.Select:
      default:
        query = this.toSelectSQL();
        break;
    }

    return { text: query, values: this.values };
  }

  /**
   * Generate `UPDATE` query string
   */
  private toUpdateSQL(): string {
    let query: string[] = [
      `UPDATE ${quote(this.description.tableName, this.dialect)} SET`,
    ];

    // Prevent to continue if there is no value
    if (!this.description.values) {
      throw new Error("Cannot perform update query without values!");
    }

    // Map values to query string
    const values = Object
      .entries(this.description.values)
      .map(([key, value]) =>
        `${quote(key, this.dialect)} = ${this.bindValue(value)}`
      );

    // Prevent to continue if there is no value
    if (!(values.length >= 1)) {
      throw new Error("Cannot perform update query without values!");
    }

    query.push(values.join(", "));

    // Add all query constraints
    query = query.concat(this.collectConstraints());

    // Add RETURNING statement if exists
    if (this.description.returning.length > 0) {
      const returnings = uniqueColumnNames(this.description.returning);

      query.push(
        "RETURNING",
        returnings.map((item) => quote(item, this.dialect))
          .join(", "),
      );
    }

    return query.join(" ") + ";";
  }

  /**
   * Generate `INSERT` query string
   */
  private toInsertSQL(replace = false): string {
    const tableName = quote(this.description.tableName, this.dialect);

    // Initialize query string
    // Decide wether to use REPLACE or INSERT
    const query: string[] = replace
      ? [`REPLACE INTO ${tableName}`]
      : [`INSERT INTO ${tableName}`];

    // Prevent to continue if there is no value
    if (!this.description.values) {
      throw new Error(
        `Cannot perform ${
          replace ? "replace" : "insert"
        } query without values!`,
      );
    }

    // If the user passes multiple records, map the values differently
    if (Array.isArray(this.description.values)) {
      if (!(this.description.values.length >= 1)) {
        throw new Error(
          `Cannot perform ${
            replace ? "replace" : "insert"
          } query without values!`,
        );
      }

      // Get all inserted columns from the values
      const fields = this.description.values
        .map((v) => Object.keys(v))
        .reduce((accumulator, currentValue) => {
          for (const field of currentValue) {
            if (!accumulator.includes(field)) {
              accumulator.push(field);
            }
          }

          return accumulator;
        });

      if (!(fields.length >= 1)) {
        throw new Error(
          `Cannot perform ${
            replace ? "replace" : "insert"
          } query without values!`,
        );
      }

      // Map values to query string
      const values = this.description.values.map((item) => {
        const itemValues = fields.map((field) => this.bindValue(item[field]));
        return `(${itemValues.join(", ")})`;
      });

      const columns = fields
        .map((field) => quote(field, this.dialect))
        .join(", ");
      query.push(`(${columns})`, "VALUES", values.join(", "));
    } else {
      const fields = Object.keys(this.description.values);

      if (!(fields.length >= 1)) {
        throw new Error(
          `Cannot perform ${
            replace ? "replace" : "insert"
          } query without values!`,
        );
      }

      const values = Object.values(this.description.values)
        .map((i) => this.bindValue(i))
        .join(", ");
      const columns = fields.map((field) => quote(field, this.dialect)).join(
        ", ",
      );
      query.push(`(${columns}) VALUES (${values})`);
    }

    // Add RETURNING statement if exists
    if (this.description.returning.length > 0) {
      query.push(
        "RETURNING",
        this.description.returning.map((item) => quote(item, this.dialect))
          .join(", "),
      );
    }

    return query.join(" ") + ";";
  }

  /**
   * Generate `SELECT` query string
   */
  private toSelectSQL(): string {
    // Query strings
    let query: string[] = [`SELECT`];

    const tableName = quote(this.description.tableName, this.dialect);

    if (this.description.counts.length >= 1) {
      // Append COUNT statements.
      const counts = this.description.counts
        .map((column) => {
          const names = column.columns
            .map((item) => this.getColumnName(item))
            .join(", ");
          const count = column.distinct
            ? `COUNT(DISTINCT(${names}))`
            : `COUNT(${names})`;
          return column.as
            ? count + " AS " + quote(column.as, this.dialect)
            : count;
        })
        .join(", ");
      query.push(counts);
    } else {
      // Remove duplicate column names
      const columns = uniqueColumnNames(this.description.columns);

      if (columns.length >= 1) {
        // Add all selected table columns.
        query.push(
          columns
            .map((column) => this.getColumnName(column))
            .join(", "),
        );
      } else {
        // If none of those above are defined, get all columns from the table.
        query.push(`${tableName}.*`);
      }
    }

    // Add table name
    query.push(`FROM ${tableName}`);

    // Add all query constraints
    query = query.concat(this.collectConstraints());

    return query.join(" ") + ";";
  }

  /**
   * Generate `DELETE` query string
   */
  private toDeleteSQL(): string {
    // Query strings
    let query: string[] = [
      `DELETE FROM ${quote(this.description.tableName, this.dialect)}`,
    ];

    // Add all query constraints
    const constraints = this.collectConstraints();
    if (!(constraints.length >= 1)) {
      throw new Error("Cannot perform delete without any constraints!");
    }
    query = query.concat(constraints);

    return query.join(" ") + ";";
  }

  /**
   * Collect query constraints in the current query
   *
   * Example result:
   *
   * ```
   * ["WHERE `users`.`email` = ?", "AND `users`.`age` > 16", "LIMIT 1"]
   * ```
   */
  private collectConstraints(): string[] {
    // Query strings (that contain constraints only)
    const query: string[] = [];

    // Joins
    if (this.description.joins && this.description.joins.length >= 1) {
      for (const join of this.description.joins) {
        const joinTableName = quote(join.table, this.dialect);
        const columnA = this.getColumnName(join.columnA);
        const columnB = this.getColumnName(join.columnB);

        switch (join.type) {
          case JoinType.Right:
            query.push(
              `RIGHT OUTER JOIN ${joinTableName} ON ${columnA} = ${columnB}`,
            );
            break;

          case JoinType.Left:
            query.push(
              `LEFT OUTER JOIN ${joinTableName} ON ${columnA} = ${columnB}`,
            );
            break;

          case JoinType.Full:
            query.push(
              `FULL OUTER JOIN ${joinTableName} ON ${columnA} = ${columnB}`,
            );
            break;

          case JoinType.Inner:
          default:
            query.push(
              `INNER JOIN ${joinTableName} ON ${columnA} = ${columnB}`,
            );
            break;
        }
      }
    }

    // Add where clauses if exists
    if (this.description.wheres.length > 0) {
      query.push(
        this.getWhereBindings("WHERE", this.description.wheres),
      );
    }

    if (this.description.groupBy.length > 0) {
      const columns = uniqueColumnNames(this.description.groupBy)
        .map((item) => this.getColumnName(item))
        .join(", ");
      query.push(`GROUP BY ${columns}`);
    }

    if (this.description.havings.length > 0) {
      query.push(
        this.getWhereBindings("HAVING", this.description.havings),
      );
    }

    // Add "order by" clauses
    if (this.description.orders.length > 0) {
      const orders = this.description.orders
        .map((order) => `${order.column} ${order.order}`)
        .join(", ");

      query.push(`ORDER BY ${orders}`);
    }

    // Add query limit if exists
    if (this.description.limit && this.description.limit > 0) {
      query.push(`LIMIT ${this.description.limit}`);
    }

    // Add query offset if exists
    if (this.description.offset && this.description.offset > 0) {
      query.push(`OFFSET ${this.description.offset}`);
    }

    return query;
  }

  /**
   * Transform value to a format that the database can understand
   *
   * @param value The value to be sanitized
   */
  private bindValue(value: DatabaseValues | DatabaseValues[]): string {
    if (Array.isArray(value)) {
      const values = value
        .map((item) => this.bindValue(item))
        .join(", ");
      return `(${values})`;
    }

    if (typeof value === "undefined" || value === null) {
      return "NULL";
    }

    if (typeof value === "boolean") {
      if (this.dialect === "mysql" || this.dialect === "sqlite3") {
        return value ? "1" : "0";
      } else {
        return value ? "TRUE" : "FALSE";
      }
    }

    if (ArrayBuffer.isView(value)) {
      if (this.dialect === "mysql" || this.dialect === "sqlite3") {
        return `x'${toHex(value)}'`;
      } else {
        return `'\\x${toHex(value)}'`;
      }
    }

    if (value instanceof Date) {
      this.values.push(formatDate(value));
    } else {
      this.values.push(value);
    }

    return this.getPlaceholder();
  }

  private getPlaceholder() {
    switch (this.dialect) {
      case "mysql":
      case "sqlite3":
        return "?";
      case "pg":
        return "$" + this.values.length;
      default:
        throw new Error(
          `Dialect '${this.dialect}' is not supported yet!`,
        );
    }
  }

  private getColumnName(column: string | string[]): string {
    if (Array.isArray(column)) {
      if (column.length !== 2) {
        throw new Error("Alias must have two values!");
      }

      return this.normalizeColumnName(column[0]) + " AS " + column[1];
    } else {
      return this.normalizeColumnName(column);
    }
  }

  private normalizeColumnName(column: string) {
    if (column === "*") {
      return column;
    }

    const data = column.split(".");

    // If the column name contains a dot, we assume that the
    // user wants to select a column from another table.
    if (data.length === 1) {
      return quote(this.description.tableName, this.dialect) + "." +
        quote(column, this.dialect);
    } else if (data.length === 2) {
      return quote(data[0], this.dialect) + "." +
        quote(data[1], this.dialect);
    } else {
      throw new Error(`'${column}' is an invalid column name!`);
    }
  }

  /**
   * Compile where bindings from query description to a string.
   *
   * Example result:
   *
   * ```
   * WHERE `users`.`email` = ? AND `users`.`age` >= ?
   * ```
   *
   * @param keyword define whether the it's using WHERE or HAVING
   * @param bindings bindings from the query description
   */
  private getWhereBindings(
    keyword: "WHERE" | "HAVING",
    bindings: WhereBinding[],
  ): string {
    const query: string[] = [];

    for (let index = 0; index < bindings.length; index++) {
      let { type, expression: { operator, value }, column } = bindings[index];

      if (this.dialect === "sqlite3") {
        if (operator === QueryOperator.Ilike) operator = QueryOperator.Like;
      }

      // Get the table name, column name, and the operator.
      // Example: "`users`.`id` = "
      let expression = `${this.getColumnName(column)} ${operator}`;

      // Add the value to the WHERE clause, if the operator is BETWEEN,
      // use AND keyword to seperate both values.
      if (operator === QueryOperator.Between) {
        if (!Array.isArray(value) || value.length !== 2) {
          throw new Error("BETWEEN must have two values!");
        }

        const a = this.bindValue(value[0]);
        const b = this.bindValue(value[1]);
        expression += ` ${a} AND ${b}`;
      } else if (
        operator !== QueryOperator.Null &&
        operator !== QueryOperator.NotNull
      ) {
        expression += ` ${this.bindValue(value)}`;
      }

      if (index === 0) {
        // The first where clause should have `WHERE` or `HAVING` explicitly.
        if (type === WhereType.Not) {
          query.push(`${keyword} NOT ${expression}`);
        } else {
          query.push(`${keyword} ${expression}`);
        }
      } else {
        // The rest of them use `AND`
        switch (type) {
          case WhereType.Not:
            query.push(`AND NOT ${expression}`);
            break;
          case WhereType.Or:
            query.push(`OR ${expression}`);
            break;
          case WhereType.Default:
          default:
            query.push(`AND ${expression}`);
            break;
        }
      }
    }

    return query.join(" ");
  }
}
