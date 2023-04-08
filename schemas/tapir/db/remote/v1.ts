import { ColumnType } from "$/lib/sql/mod.ts";

const { Integer, String, Boolean, Date, Json, Blob } = ColumnType;

const Spec = {
  version: 1,
  tables: {
    server: {
      primaryKey: "url",
      columns: {
        url: { type: String },
        displayName: { type: String, nullable: true },
        summary: { type: String, nullable: true },
        software: { type: String, nullable: true },
        softwareVersion: { type: String, nullable: true },
        logo: { type: String, foreignKey: "media", nullable: true },
        logoBlurhash: { type: String, nullable: true },
        logoUrl: { type: String, nullable: true },
        lastSeen: { type: Date },
      },
    },
    actor: {
      primaryKey: "id",
      columns: {
        id: { type: String },
        name: { type: String },
        server: { type: String, foreignKey: "server" },
        displayName: { type: String },
        summary: { type: String, default: "" },
        profileMetadata: { type: Json, default: {} },
        requestToFollow: { type: Boolean, default: false },
        updatedAt: { type: Date },
        avatar: { type: String, foreignKey: "media", nullable: true },
        avatarBlurhash: { type: String, nullable: true },
        avatarUrl: { type: String, nullable: true },
        banner: { type: String, foreignKey: "media", nullable: true },
        bannerBlurhash: { type: String, nullable: true },
        bannerUrl: { type: String, nullable: true },
      },
    },
    post: {
      primaryKey: "fullId",
      columns: {
        fullId: { type: String },
        actor: { type: String, foreignKey: "actor" },
        type: { type: Integer },
        interactable: { type: Boolean, default: true },
        url: { type: String, nullable: true },
        createdAt: { type: Date },
        updatedAt: { type: Date, nullable: true },
        viewedAt: { type: Date, nullable: true },
        content: { type: String, nullable: true },
        lang: { type: String, nullable: true },
        targetPost: { type: String, nullable: true },
      },
    },
    reaction: {
      primaryKey: "fullId",
      columns: {
        fullId: { type: String },
        post: { type: String, foreignKey: "post" },
        actor: { type: String, foreignKey: "actor" },
        createdAt: { type: Date },
        content: { type: String, nullable: true },
      },
    },
    activity: {
      primaryKey: "id",
      columns: {
        id: { type: String },
        json: { type: Json },
        actor: { type: String, foreignKey: "actor" },
      },
    },
    media: {
      primaryKey: "hash",
      columns: {
        hash: { type: String },
        mimetype: { type: String },
        bytes: { type: Integer },
        data: { type: Blob, nullable: true },
        width: { type: Integer, nullable: true },
        height: { type: Integer, nullable: true },
        duration: { type: Integer, nullable: true },
        createdAt: { type: Date },
      },
    },
    attachment: {
      primaryKey: "id",
      columns: {
        id: { type: Integer, autoIncrement: true },
        type: { type: Integer },
        postId: { type: String, foreignKey: "post" },
        original: { type: String, foreignKey: "media", nullable: true },
        originalUrl: { type: String },
        small: { type: String, foreignKey: "media", nullable: true },
        smallUrl: { type: String, nullable: true },
        blurhash: { type: String, nullable: true },
        alt: { type: String, nullable: true },
      },
    },
    linkCard: {
      primaryKey: "url",
      columns: {
        url: { type: String },
        title: { type: String },
        summary: { type: String, nullable: true },
        image: { type: String, nullable: true, foreignKey: "media" },
        imageBlurhash: { type: String, nullable: true },
        favicon: { type: String, nullable: true, foreignKey: "media" },
        fetchedAt: { type: Date },
      },
    },
    postQuote: {
      primaryKey: "id",
      columns: {
        id: { type: Integer, autoIncrement: true },
        quoter: { type: String, foreignKey: "post" },
        quoted: { type: String, foreignKey: "post" },
      },
    },
    postLinkCard: {
      primaryKey: "id",
      columns: {
        id: { type: Integer, autoIncrement: true },
        post: { type: String, foreignKey: "post" },
        link: { type: String, foreignKey: "linkCard" },
      },
    },
  },
} as const;

export default Spec;
