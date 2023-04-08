import { base64, toml } from "$/deps.ts";
import { ColumnType, DatabaseSpec, DBLike } from "$/lib/sql/mod.ts";
import { asyncToArray } from "$/lib/utils.ts";
import v3 from "./v3.ts";

const { Integer, String, Boolean, Ulid, Json, Blob } = ColumnType;

const Spec = {
  version: 4,
  tables: {
    ...v3.tables,
    persona: {
      ...v3.tables.persona,
      indexes: ["main"],
      columns: {
        ...v3.tables.persona.columns,
        profileMetadata: { type: Json, default: {} },
        publicKey: { type: Blob, default: new Uint8Array(0) },
        privateKey: { type: Blob, default: new Uint8Array(0) },
      },
      async postMigrate(db: DBLike<DatabaseSpec>) {
        const oldTapirJson = JSON.parse(await Deno.readTextFile("tapir.json")),
          privateKey = new Uint8Array(
            await crypto.subtle.exportKey(
              "pkcs8",
              await crypto.subtle.importKey(
                "jwk",
                oldTapirJson.privateKey,
                {
                  name: "RSASSA-PKCS1-v1_5",
                  hash: { name: "SHA-256" },
                },
                true,
                ["sign"],
              ),
            ),
          ),
          publicKey = new Uint8Array(
            await crypto.subtle.exportKey(
              "spki",
              await crypto.subtle.importKey(
                "jwk",
                oldTapirJson.publicKey,
                {
                  name: "RSASSA-PKCS1-v1_5",
                  hash: { name: "SHA-256" },
                },
                true,
                ["verify"],
              ),
            ),
          );
        await db.update("persona", {}, { privateKey, publicKey });
      },
    },
    post: {
      ...v3.tables.post,
      indexes: ["createdAt", ["persona", "createdAt"]],
    },
    inFollow: {
      ...v3.tables.inFollow,
      indexes: [["persona", "actor"], ["persona", "acceptedAt"]],
      columns: {
        id: { type: String },
        persona: { type: String, foreignKey: "persona" },
        actor: { type: String, foreignKey: "knownActor" },
        createdAt: { type: ColumnType.Date },
        acceptedAt: { type: ColumnType.Date, nullable: true },
      },
    },
    outFollow: {
      ...v3.tables.outFollow,
      indexes: [["persona", "actor"], ["persona", "acceptedAt"]],
      columns: {
        id: { type: Ulid },
        persona: { type: String, foreignKey: "persona" },
        actor: { type: String, foreignKey: "knownActor" },
        createdAt: { type: ColumnType.Date },
        acceptedAt: { type: ColumnType.Date, nullable: true },
      },
    },
    inBoost: {
      ...v3.tables.inBoost,
      indexes: ["localPost"],
    },
    inReact: {
      ...v3.tables.inReact,
      indexes: ["localPost"],
    },
    outReact: {
      ...v3.tables.outReact,
      indexes: ["remotePost", "persona"],
    },
    media: {
      ...v3.tables.media,
      columns: {
        ...v3.tables.media.columns,
        data: { type: Blob, nullable: true },
      },
    },
    activity: {
      ...v3.tables.activity,
      columns: {
        id: { type: Ulid },
        json: { type: Json },
        persona: { type: String, foreignKey: "persona" },
      },
    },
    knownActor: {
      primaryKey: "url",
      indexes: ["server"],
      columns: {
        url: { type: String },
        name: { type: String },
        displayName: { type: String, nullable: true },
        profileUrl: { type: String },
        smallAvatar: { type: Blob, nullable: true },
        publicKey: { type: Blob, nullable: true },
        publicKeyId: { type: String, nullable: true },
        publicKeyType: { type: String, nullable: true },
        server: { type: String, foreignKey: "knownServer" },
        inbox: { type: String },
        outbox: { type: String },
        lastSeen: { type: ColumnType.Date, nullable: true },
        updatedAt: { type: ColumnType.Date },
      },
      preMigrate(db: DBLike<DatabaseSpec>) {
        return asyncToArray(db.get("inFollow", {}));
      },
      async postMigrate(db: DBLike<DatabaseSpec>, preMigrateState: unknown) {
        type Follow = {
          actor: string;
          inbox: string;
          server: string;
          name: string;
        };
        const inFollows = preMigrateState as Follow[],
          inFollowsByActor = new Map<string, Follow>();
        inFollows.forEach((f) => inFollowsByActor.set(f.actor, f));
        await db.insert(
          "knownActor",
          [...inFollowsByActor.values()].map((
            { actor, inbox, server, name },
          ) => ({
            url: actor,
            name,
            profileUrl: actor,
            server,
            inbox,
            outbox: "",
            updatedAt: Date.now(),
          })),
        );
      },
    },
    activityDispatch: {
      primaryKey: "id",
      indexes: [["inbox", "activity"], ["receivedAt", "failed"]],
      columns: {
        id: { type: Integer, autoIncrement: true },
        inbox: { type: String },
        activity: { type: String, foreignKey: "activity" },
        failed: { type: Boolean, default: false },
        createdAt: { type: ColumnType.Date },
        receivedAt: { type: ColumnType.Date, nullable: true },
      },
    },
    instanceConfig: {
      primaryKey: "key",
      columns: {
        key: { type: Boolean },
        displayName: { type: String },
        summary: { type: String },
        adminEmail: { type: String },
        loginName: { type: String },
        passwordHash: { type: Blob },
        passwordSalt: { type: Blob },
        mediaSalt: { type: Blob },
        locale: { type: String },
        maxCharacters: { type: Integer },
        maxMediaAttachments: { type: Integer },
        maxImageBytes: { type: Integer },
        maxImagePixels: { type: Integer },
        maxVideoBytes: { type: Integer },
        maxVideoPixels: { type: Integer },
        maxVideoFramerate: { type: Integer },
        logo: { type: String, foreignKey: "media", nullable: true },
        updatedAt: { type: ColumnType.Date },
      },
      async postMigrate(db: DBLike<DatabaseSpec>) {
        const oldTapirJson = JSON.parse(await Deno.readTextFile("tapir.json"));
        db.insert("instanceConfig", [{
          key: true,
          adminEmail: "",
          displayName: oldTapirJson.displayName,
          summary: oldTapirJson.summary,
          loginName: oldTapirJson.loginName,
          maxCharacters: 65536,
          maxMediaAttachments: 32,
          maxImageBytes: 1024 * 1024 * 16,
          maxImagePixels: 3840 * 2160,
          maxVideoBytes: 1024 * 1024 * 256,
          maxVideoPixels: 1920 * 1080,
          maxVideoFramerate: 60,
          passwordHash: base64.decode(oldTapirJson.passwordHash),
          passwordSalt: base64.decode(oldTapirJson.passwordSalt),
          mediaSalt: base64.decode(oldTapirJson.mediaSalt),
          locale: oldTapirJson.locale,
          updatedAt: new Date(),
        }]);
        await Deno.writeTextFile(
          "tapir.toml",
          toml.stringify({
            url: oldTapirJson.url,
            domain: oldTapirJson.domain,
            dataDir: oldTapirJson.dataDir,
            localDatabase: oldTapirJson.localDatabase,
            localMedia: oldTapirJson.localMedia,
          }),
        );
      },
    },
  },
} as const;

export default Spec;
