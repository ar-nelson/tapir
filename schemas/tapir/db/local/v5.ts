import { ColumnType } from "$/lib/sql/mod.ts";
import { chainFrom } from "$/lib/transducers.ts";
import * as urls from "$/lib/urls.ts";
import {
  KeyAlgorithm,
  ProfileType,
  protoAddrToString,
  Protocol,
  TrustLevel,
} from "$/models/types.ts";
import v4 from "./v4.ts";

const { Integer, String, Blob, Boolean, Date } = ColumnType;

// deno-lint-ignore no-unused-vars
const { inFollow, outFollow, ...v4Tables } = v4.tables;

// Intermediate version to delete and recreate inFollow/outFollow with new keys
const v4_5 = v4.newVersion(4.5, {
  ...v4Tables,
  inFollowTemp: {
    primaryKey: "id",
    indexes: [
      ["persona", "remoteProfile"],
      ["persona", "acceptedAt"],
      ["persona", "acceptedAt", "public"],
    ],
    columns: {
      id: { type: Integer, autoIncrement: true },
      persona: { type: String, foreignKey: "persona" },
      remoteProfile: { type: String },
      remoteActivity: { type: String, nullable: true },
      createdAt: { type: Date },
      acceptedAt: { type: Date, nullable: true },
      public: { type: Boolean, default: true },
    },
  },
  outFollowTemp: {
    primaryKey: "remoteProfile",
    indexes: ["acceptedAt", ["acceptedAt", "public"]],
    columns: {
      remoteProfile: { type: String },
      activity: { type: String, nullable: true, foreignKey: "activity" },
      createdAt: { type: Date },
      acceptedAt: { type: Date, nullable: true },
      public: { type: Boolean, default: true },
    },
  },
}).prePostMigrate(
  async (db) => ({
    inFollows: await chainFrom(db.get("inFollow")).toArray(),
    outFollows: await chainFrom(db.get("outFollow")).toArray(),
  }),
  async (db, { inFollows, outFollows }) => {
    await db.insert(
      "inFollowTemp",
      inFollows.map((i) => ({
        persona: i.persona,
        remoteProfile: protoAddrToString({
          protocol: Protocol.ActivityPub,
          path: i.actor,
        }),
        remoteActivity: i.id,
        createdAt: i.createdAt,
        acceptedAt: i.acceptedAt,
        public: true,
      })),
    );
    await db.insert(
      "outFollowTemp",
      outFollows.map((o) => ({
        remoteProfile: protoAddrToString({
          protocol: Protocol.ActivityPub,
          path: o.actor,
        }),
        activity: o.id,
        createdAt: o.createdAt,
        acceptedAt: o.acceptedAt,
        public: true,
      })),
    );
  },
);

const {
  // deno-lint-ignore no-unused-vars
  knownActor,
  // deno-lint-ignore no-unused-vars
  knownServer,
  // deno-lint-ignore no-unused-vars
  blockedServer,
  activityDispatch,
  inFollowTemp,
  outFollowTemp,
  post: {
    columns: {
      content: _c,
      collapseSummary: _cs,
      targetLocalPost: _tlp,
      targetRemotePost: _trp,
      ...postColumns
    },
    ...post
  },
  persona: {
    columns: {
      publicKey: _p1,
      privateKey: _p2,
      summary: _s,
      ...personaColumns
    },
    ...persona
  },
  inReact: { columns: { actor: _a1, ...inReactColumns }, ...inReact },
  inBoost: { columns: { actor: _a2, ...inBoostColumns }, ...inBoost },
  ...oldTables
} = v4_5.tables;

const Spec = v4_5.newVersion(5, {
  ...oldTables,
  inFollow: {
    ...inFollowTemp,
    columns: {
      ...inFollowTemp.columns,
      remoteProfile: { type: String, foreignKey: "profileTrust" },
    },
    renamedFrom: "inFollowTemp",
  },
  outFollow: {
    ...outFollowTemp,
    columns: {
      ...outFollowTemp.columns,
      remoteProfile: { type: String, foreignKey: "profileTrust" },
    },
    renamedFrom: "outFollowTemp",
  },
  inReact: {
    ...inReact,
    columns: {
      ...inReactColumns,
      remoteProfile: {
        type: String,
        foreignKey: "profileTrust",
        renamedFrom: "actor",
      },
    },
  },
  inBoost: {
    ...inBoost,
    columns: {
      ...inBoostColumns,
      remoteProfile: {
        type: String,
        foreignKey: "profileTrust",
        renamedFrom: "actor",
      },
    },
  },
  post: {
    ...post,
    columns: {
      ...postColumns,
      contentHtml: { type: String, renamedFrom: "content", nullable: true },
      contentRaw: { type: String, nullable: true },
      contentRawMimetype: { type: String, nullable: true },
      contentWarning: {
        type: String,
        renamedFrom: "collapseSummary",
        nullable: true,
      },
      targetPost: {
        type: String,
        renamedFrom: "targetRemotePost",
        nullable: true,
      },
    },
  },
  persona: {
    ...persona,
    columns: {
      ...personaColumns,
      type: { type: String, default: ProfileType.Person },
      summaryHtml: { type: String, renamedFrom: "summary", nullable: true },
      summaryRaw: { type: String, nullable: true },
      summaryRawMimetype: { type: String, nullable: true },
    },
  },
  activityDispatch: {
    ...activityDispatch,
    columns: {
      ...activityDispatch.columns,
      key: { type: String, foreignKey: "key", nullable: true },
    },
  },
  key: {
    primaryKey: "name",
    columns: {
      name: { type: String },
      algorithm: { type: Integer },
      private: { type: Blob },
      public: { type: Blob, nullable: true },
    },
  },
  personaKey: {
    primaryKey: "id",
    indexes: ["persona"],
    columns: {
      id: { type: Integer, autoIncrement: true },
      persona: { type: String, foreignKey: "persona" },
      key: { type: String, foreignKey: "key" },
    },
  },
  replyTrust: {
    primaryKey: "addr",
    indexes: [["replyToAddr", "trusted"]],
    columns: {
      addr: { type: String },
      remoteProfile: { type: String, foreignKey: "profileTrust" },
      replyToAddr: { type: String },
      trusted: { type: Boolean, default: false },
      lastSeen: { type: Date },
    },
  },
  profileTrust: {
    primaryKey: "addr",
    columns: {
      addr: { type: String },
      domain: { type: String, nullable: true, foreignKey: "domainTrust" },
      requestToTrust: { type: Integer, default: TrustLevel.Unset },
      requestFromTrust: { type: Integer, default: TrustLevel.Unset },
      mediaTrust: { type: Integer, default: TrustLevel.Unset },
      feedTrust: { type: Integer, default: TrustLevel.Unset },
      replyTrust: { type: Integer, default: TrustLevel.Unset },
      dmTrust: { type: Integer, default: TrustLevel.Unset },
      privateNote: { type: String, nullable: true },
      updatedAt: { type: Date, nullable: true },
    },
  },
  domainTrust: {
    primaryKey: "domain",
    indexes: ["requestFromTrust", "friendly"],
    columns: {
      domain: { type: String },
      requestToTrust: { type: Integer, default: TrustLevel.Unset },
      requestFromTrust: { type: Integer, default: TrustLevel.Unset },
      mediaTrust: { type: Integer, default: TrustLevel.Unset },
      feedTrust: { type: Integer, default: TrustLevel.Unset },
      replyTrust: { type: Integer, default: TrustLevel.Unset },
      dmTrust: { type: Integer, default: TrustLevel.Unset },
      privateNote: { type: String, nullable: true },
      blockReason: { type: String, nullable: true },
      friendly: { type: Boolean, default: false },
      updatedAt: { type: Date, nullable: true },
    },
  },
}).prePostMigrate(
  async (db) => ({
    personas: await chainFrom(db.get("persona")).toArray(),
    knownActors: await chainFrom(db.get("knownActor")).toArray(),
    knownServers: await chainFrom(db.get("knownServer")).toArray(),
    blockedServers: await chainFrom(db.get("blockedServer")).toArray(),
  }),
  async (db, { personas, knownActors, knownServers, blockedServers }) => {
    for (const { name, publicKey, privateKey } of personas) {
      await db.insert("key", [{
        name: urls.activityPubMainKey(name),
        algorithm: KeyAlgorithm.RSA_SHA256,
        public: publicKey,
        private: privateKey,
      }]);
      await db.insert("personaKey", [{
        persona: name,
        key: urls.activityPubMainKey(name),
      }]);
    }
    await db.insert(
      "profileTrust",
      knownActors.map((a) => ({
        addr: protoAddrToString({
          protocol: Protocol.ActivityPub,
          path: a.outbox.slice(0, a.outbox.lastIndexOf("/")),
        }),
        domain: urls.normalizeDomain(a.server),
        updatedAt: a.updatedAt,
      })),
    );
    await db.insert(
      "domainTrust",
      knownServers.filter((s) =>
        !blockedServers.some((b) => s.url.includes(b.domain))
      ).map((s) => ({
        domain: new URL(s.url).hostname,
      })),
    );
    await db.insert(
      "domainTrust",
      blockedServers.map((s) => ({
        domain: s.domain,
        requestToTrust: s.blockActivity
          ? TrustLevel.BlockUnconditional
          : TrustLevel.Unset,
        requestFromTrust: s.blockActivity
          ? TrustLevel.BlockUnconditional
          : TrustLevel.Unset,
        replyTrust: s.blockActivity
          ? TrustLevel.BlockUnconditional
          : TrustLevel.Unset,
        dmTrust: s.blockActivity
          ? TrustLevel.BlockUnconditional
          : TrustLevel.Unset,
        mediaTrust: s.blockMedia
          ? TrustLevel.BlockUnconditional
          : TrustLevel.Unset,
        feedTrust: s.hideInFeeds
          ? TrustLevel.BlockUnconditional
          : TrustLevel.Unset,
        updatedAt: s.createdAt,
      })),
    );
  },
);

export default Spec;
