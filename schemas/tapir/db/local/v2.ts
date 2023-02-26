import { ColumnType } from "$/lib/sql/mod.ts";
import v1 from "./v1.ts";

const { Integer, String, Date, Ulid } = ColumnType;

const Spec = {
  version: 2,
  tables: {
    ...v1.tables,
    persona: {
      primaryKey: "name",
      columns: {
        ...v1.tables.persona.columns,
        avatar: { type: String, foreignKey: "media", nullable: true },
      },
    },
    media: {
      primaryKey: "hash",
      columns: {
        hash: { type: String },
        mimetype: { type: String },
        bytes: { type: Integer },
        width: { type: Integer, nullable: true },
        height: { type: Integer, nullable: true },
        duration: { type: Integer, nullable: true },
        createdAt: { type: Date },
      },
    },
    attachment: {
      primaryKey: "id",
      columns: {
        id: { type: Ulid },
        type: { type: Integer },
        postId: { type: Ulid, foreignKey: "post" },
        original: { type: String, foreignKey: "media" },
        small: { type: String, foreignKey: "media", nullable: true },
        blurhash: { type: String, nullable: true },
        alt: { type: String, nullable: true },
      },
    },
  },
} as const;

export default Spec;
