import { ColumnType } from "$/lib/sql/mod.ts";
import v2 from "./v2.ts";

const { String } = ColumnType;

const Spec = v2.newVersion(3, {
  ...v2.tables,
  persona: {
    primaryKey: "name",
    columns: {
      ...v2.tables.persona.columns,
      banner: { type: String, foreignKey: "media", nullable: true },
      linkTitle: { type: String, nullable: true },
    },
  },
});

export default Spec;
