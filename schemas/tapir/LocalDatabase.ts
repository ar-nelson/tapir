import { ColumnType } from "$/lib/sql/mod.ts";

const { Integer, String, Boolean, Date, Ulid, Json } = ColumnType;

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
        main: { type: Boolean, default: false },
        displayName: { type: String },
        summary: { type: String, default: "" },
        requestToFollow: { type: Boolean, default: false },
        discoverable: { type: Boolean, default: true },
        createdAt: { type: Date },
        updatedAt: { type: Date },
      },
    },
    post: {
      primaryKey: "id",
      columns: {
        id: { type: Ulid },
        persona: { type: String, foreignKey: "persona" },
        type: { type: Integer },
        createdAt: { type: Date },
        updatedAt: { type: Date, nullable: true },
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
        name: { type: String },
        server: { type: String, foreignKey: "knownServer" },
        inbox: { type: String },
        createdAt: { type: Date },
        acceptedAt: { type: Date, nullable: true },
      },
    },
    inBoost: {
      primaryKey: "id",
      columns: {
        id: { type: String },
        localPost: { type: Ulid, foreignKey: "post" },
        actor: { type: String },
        createdAt: { type: Date },
      },
    },
    inReact: {
      primaryKey: "id",
      columns: {
        id: { type: String },
        localPost: { type: Ulid, foreignKey: "post" },
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
        server: { type: String, foreignKey: "knownServer" },
        outbox: { type: String },
        createdAt: { type: Date },
        acceptedAt: { type: Date, nullable: true },
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
    knownServer: {
      primaryKey: "url",
      columns: {
        url: { type: String },
        sharedInbox: { type: String, nullable: true },
        firstSeen: { type: Date },
        lastSeen: { type: Date },
      },
    },
    blockedServer: {
      primaryKey: "domain",
      columns: {
        domain: { type: String },
        createdAt: { type: Date },
        blockActivity: { type: Boolean, default: true },
        blockMedia: { type: Boolean, default: true },
        hideInFeeds: { type: Boolean, default: true },
      },
    },
    activity: {
      primaryKey: "id",
      columns: {
        id: { type: Ulid },
        json: { type: Json },
        persona: { type: String, foreignKey: "persona" },
        sent: { type: Boolean, default: false },
      },
    },
  },
} as const;
