import { ColumnType, DatabaseSpec } from "$/services/DatabaseService.ts";

const { Integer, String, Date, Ulid } = ColumnType;

export enum PostType {
  Note = 0,
  Reply = 1,
  Boost = 2,
  Quote = 3,
  Poll = 4,
}

export const LocalDatabaseSpec = {
  version: 1,
  tables: {
    persona: {
      primaryKey: "name",
      columns: {
        name: { type: String },
        displayName: { type: String },
        summary: { type: String, default: "" },
        createdAt: { type: Date },
        updatedAt: { type: Date },
      },
    },
    localPost: {
      primaryKey: "id",
      columns: {
        id: { type: Ulid },
        persona: { type: String, foreignKey: "persona" },
        type: { type: Integer },
        createdAt: { type: Date },
        updatedAt: { type: Date },
        content: { type: String, nullable: true },
        targetLocalPost: {
          type: Ulid,
          foreignKey: "localPost",
          nullable: true,
        },
        targetRemotePost: { type: String, nullable: true },
        collapseSummary: { type: String, nullable: true },
      },
    },
    inFollow: {
      primaryKey: "id",
      columns: {
        id: { type: String },
        persona: { type: String, foreignKey: "persona" },
        actor: { type: String },
        createdAt: { type: Date },
      },
    },
    inBoost: {
      primaryKey: "id",
      columns: {
        id: { type: String },
        localPost: { type: Ulid, foreignKey: "localPost" },
        actor: { type: String },
        createdAt: { type: Date },
      },
    },
    inReact: {
      primaryKey: "id",
      columns: {
        id: { type: String },
        localPost: { type: Ulid, foreignKey: "localPost" },
        actor: { type: String },
        createdAt: { type: Date },
        content: { type: String, nullable: true },
      },
    },
    outFollow: {
      primaryKey: "id",
      columns: {
        id: { type: Ulid },
        persona: { type: String, foreignKey: "persona" },
        actor: { type: String },
        accepted: { type: Integer },
        createdAt: { type: Date },
        lastUpdateSent: { type: Date },
      },
    },
    outReact: {
      primaryKey: "id",
      columns: {
        id: { type: Ulid },
        persona: { type: String, foreignKey: "persona" },
        remotePost: { type: String },
        createdAt: { type: Date },
        content: { type: String, nullable: true },
      },
    },
  },
};

const _typecheck: DatabaseSpec = LocalDatabaseSpec;
