import { base64 } from "$/deps.ts";
import { CrockfordBase32 } from "$/lib/base32.ts";
import { DateDiff, datetime } from "$/lib/datetime/mod.ts";
import { SOFTWARE_FEATURES } from "$/lib/softwareFeatures.ts";
import { ulid } from "$/lib/ulid.ts";
import { normalizeDomain, protoAddrInstance, urlJoin } from "$/lib/urls.ts";
import {
  DomainTrust,
  TRUST_LEVEL_BLOCKED,
  TRUST_LEVEL_DEFAULT,
  TRUST_LEVEL_TRUSTED,
} from "$/models/DomainTrust.ts";
import { InstanceConfig } from "$/models/InstanceConfig.ts";
import { ProfileTrust } from "$/models/ProfileTrust.ts";
import {
  AttachmentType,
  InFollow,
  LocalAttachment,
  LocalPost,
  Media,
  parseProtoAddr,
  Persona,
  PostType,
  ProfileType,
  Protocol,
  RemoteInstance,
  RemoteMedia,
  RemotePostFull,
  RemoteProfile,
} from "$/models/types.ts";
import { TapirConfig } from "$/schemas/tapir/TapirConfig.ts";
import { LoremIpsum } from "lorem-ipsum";
import { makeSeededGenerators } from "vegas";

export function base32ify(filename: string): string {
  return CrockfordBase32.encode(new TextEncoder().encode(filename));
}

export function unbase32ify(base32: string): string {
  return new TextDecoder().decode(CrockfordBase32.decode(base32));
}

const vegas = makeSeededGenerators("mock-data"),
  prng = () => vegas.randomFloat(),
  now = datetime(),
  ago = (diff: DateDiff) => now.subtract(diff).toJSDate(),
  lorem = new LoremIpsum({
    random: prng,
  }, "html");

export enum MockDomain {
  LOCAL = "tapir.example",
  FRIENDLY = "friendly.example",
  FAMILIAR = "familiar.example",
  UNFAMILIAR = "unfamiliar.example",
  SEMI_BLOCKED = "semi-blocked.example",
  BLOCKED = "blocked.example",
}

export const TAPIR_CONFIG: TapirConfig & { readonly url: string } = {
  domain: MockDomain.LOCAL,
  url: `https://${MockDomain.LOCAL}`,
  port: 42069,
  dataDir: "tapir-test",
  localDatabase: { type: "inmemory" },
  localMedia: { type: "inmemory" },
  remoteDatabase: { type: "inmemory" },
  remoteMedia: { type: "inmemory" },
  loggers: [{ type: "console", level: "DEBUG" }],
};

export const INSTANCE_CONFIG: InstanceConfig = {
  initialized: true,
  displayName: "Tapir Test",
  summary: "mock tapir server",
  loginName: "tapir",
  passwordHash: base64.decode("N63CXrwv0u0U7ziMTLeHh6/Qg/qoXpAB4jyzqFtmttM="), // password: "iamatapir"
  passwordSalt: base64.decode("EtVFrF66Kt11z9g10fERFg=="),
  mediaSalt: base64.decode("AAAAAAAA"),
  locale: "en-US",
  adminEmail: "admin@tapir.example",
  maxCharacters: 65536,
  maxMediaAttachments: 32,
  maxImageBytes: 1024 * 1024 * 16,
  maxImagePixels: 3840 * 2160,
  maxVideoBytes: 1024 * 1024 * 256,
  maxVideoPixels: 1920 * 1080,
  maxVideoFramerate: 60,
  updatedAt: ago({ weeks: 1 }),
};

export const DOMAIN_TRUST: Readonly<Record<MockDomain, DomainTrust>> = {
  [MockDomain.LOCAL]: {
    domain: normalizeDomain(MockDomain.LOCAL),
    friendly: true,
    ...TRUST_LEVEL_TRUSTED,
  },
  [MockDomain.FRIENDLY]: {
    domain: normalizeDomain(MockDomain.FRIENDLY),
    friendly: true,
    ...TRUST_LEVEL_TRUSTED,
  },
  [MockDomain.FAMILIAR]: {
    domain: normalizeDomain(MockDomain.FAMILIAR),
    friendly: false,
    ...TRUST_LEVEL_DEFAULT,
  },
  [MockDomain.UNFAMILIAR]: {
    domain: normalizeDomain(MockDomain.UNFAMILIAR),
    friendly: false,
    ...TRUST_LEVEL_DEFAULT,
  },
  [MockDomain.SEMI_BLOCKED]: {
    domain: normalizeDomain(MockDomain.SEMI_BLOCKED),
    friendly: false,
    ...TRUST_LEVEL_BLOCKED,
  },
  [MockDomain.BLOCKED]: {
    domain: normalizeDomain(MockDomain.BLOCKED),
    friendly: false,
    ...TRUST_LEVEL_BLOCKED,
  },
};

export enum MockPersonaName {
  MAIN = "main",
  BLOG = "blog",
  SECRET = "secret",
}

const tapirAvatarId = ulid(ago({ weeks: 1 }).getDate(), prng),
  tapirBannerId = ulid(ago({ weeks: 1 }).getDate(), prng);

export const PERSONAS: Readonly<Record<MockPersonaName, Persona>> = {
  [MockPersonaName.MAIN]: {
    name: MockPersonaName.MAIN,
    type: ProfileType.Person,
    displayName: "Tapir",
    summaryHtml: "<p>Main account</p>",
    summaryRaw: "Main account",
    summaryRawMimetype: "text/markdown",
    linkTitle: "Microblog",
    createdAt: ago({ weeks: 1 }),
    avatarAttachment: tapirAvatarId,
    bannerAttachment: tapirBannerId,
    main: true,
  },
  [MockPersonaName.BLOG]: {
    name: MockPersonaName.BLOG,
    type: ProfileType.Person,
    displayName: "Tapir's Blog",
    summaryHtml: "<p>In which I blog about Things</p>",
    summaryRaw: "In which I blog about Things",
    summaryRawMimetype: "text/markdown",
    linkTitle: "Blog",
    createdAt: ago({ weeks: 1 }),
    avatarAttachment: tapirAvatarId,
    main: false,
  },
  [MockPersonaName.SECRET]: {
    name: MockPersonaName.SECRET,
    type: ProfileType.Person,
    displayName: "Secret Tapir Zone",
    summaryHtml: "<p>Not visible to the public</p>",
    summaryRaw: "Not visible to the public",
    summaryRawMimetype: "text/markdown",
    createdAt: ago({ weeks: 1 }),
    avatarAttachment: tapirAvatarId,
    main: false,
  },
};

export enum MockRemoteProfile {
  LOCAL_MAIN = "local$main",
  LOCAL_BLOG = "local$blog",
  LOCAL_SECRET = "local$secret",

  FRIENDLY_REDPANDA = "ap$https://friendly.example/users/redpanda",
  FRIENDLY_PARROT = "ap$https://friendly.example/users/parrot",
  FRIENDLY_SLOTH = "ap$https://friendly.example/users/sloth",
  FRIENDLY_MONKEY = "ap$https://friendly.example/users/monkey",
  FRIENDLY_ARMADILLO = "ap$https://friendly.example/users/armadillo",
  FRIENDLY_BLOCKED = "ap$https://friendly.example/users/blocked",

  FAMILIAR_BADGER = "ap$https://familiar.example/users/badger",
  FAMILIAR_BEAR = "ap$https://familiar.example/users/bear",
  FAMILIAR_MOUSE = "ap$https://familiar.example/users/mouse",
  FAMILIAR_RACCOON = "ap$https://familiar.example/users/raccoon",
  FAMILIAR_HORSE = "ap$https://familiar.example/users/horse",
  FAMILIAR_BLOCKED = "ap$https://familiar.example/users/blocked",

  UNFAMILIAR_ANTELOPE = "ap$https://unfamiliar.example/users/antelope",
  UNFAMILIAR_LEMUR = "ap$https://unfamiliar.example/users/lemur",
  UNFAMILIAR_ELEPHANT = "ap$https://unfamiliar.example/users/elephant",
  UNFAMILIAR_HYENA = "ap$https://unfamiliar.example/users/hyena",
  UNFAMILIAR_ZEBRA = "ap$https://unfamiliar.example/users/zebra",
  UNFAMILIAR_BLOCKED = "ap$https://unfamiliar.example/users/blocked",

  SEMI_BLOCKED_TRUSTED = "ap$https://semi-blocked.example/users/trusted",
  SEMI_BLOCKED_UNTRUSTED = "ap$https://semi-blocked.example/users/untrusted",

  BLOCKED_GOON = "ap$https://blocked.example/users/goon",
}

const localPostDefaults = (
  persona: string,
  timeAgo: DateDiff,
  contentRaw?: string,
) => {
  const createdAt = ago(timeAgo);
  return {
    id: ulid(createdAt.getDate(), prng),
    persona,
    type: PostType.Note,
    createdAt,
    ...contentRaw
      ? {
        contentRaw,
        contentRawMimetype: "text/plain",
        contentHtml: `<p>${contentRaw}</p>`,
      }
      : {},
  };
};

export const LOCAL_POSTS: Readonly<
  Record<MockPersonaName, readonly LocalPost[]>
> = {
  [MockPersonaName.MAIN]: [{
    ...localPostDefaults(
      MockPersonaName.MAIN,
      { day: 7 },
      "just setting up my tpir",
    ),
  }, {
    ...localPostDefaults(MockPersonaName.MAIN, { day: 6 }, "some photos of me"),
  }, {
    ...localPostDefaults(
      MockPersonaName.MAIN,
      { day: 5 },
      "elephants are just fat tapirs. sorry, it's true.",
    ),
    contentWarning: "hot take",
  }, {
    ...localPostDefaults(MockPersonaName.MAIN, { day: 4 }, "a video of me"),
  }, {
    ...localPostDefaults(
      MockPersonaName.MAIN,
      { day: 3 },
      "Tapir Fact: i am living in your walls",
    ),
  }, {
    ...localPostDefaults(
      MockPersonaName.MAIN,
      { day: 2 },
      "Tapir Fact: according to japanese legend, tapirs eat dreams. this is why you've never achieved any of yours. delicious.",
    ),
  }, {
    ...localPostDefaults(
      MockPersonaName.MAIN,
      { day: 1 },
      "tapir does what mastodon't",
    ),
  }],
  [MockPersonaName.BLOG]: [{
    ...localPostDefaults(
      MockPersonaName.BLOG,
      { day: 1 },
    ),
    contentHtml: `<h1>Lorem Ipsum</h1> ${lorem.generateParagraphs(5)}`,
  }],
  [MockPersonaName.SECRET]: [],
};

const localPhotosPost = LOCAL_POSTS[MockPersonaName.MAIN][1],
  localVideoPost = LOCAL_POSTS[MockPersonaName.MAIN][3];

export const LOCAL_ATTACHMENTS: readonly LocalAttachment[] = [{
  id: tapirAvatarId,
  type: AttachmentType.Image,
  original: base32ify("tapir-avatar.webp"),
  alt: "Tapir avatar",
}, {
  id: tapirBannerId,
  type: AttachmentType.Image,
  original: base32ify("jungle1.jpg"),
  alt: "Jungle banner",
}, {
  id: ulid(localPhotosPost.createdAt.getDate(), prng),
  postId: localPhotosPost.id,
  type: AttachmentType.Image,
  original: base32ify("tapir1.jpg"),
  alt: "Photo 1",
}, {
  id: ulid(localPhotosPost.createdAt.getDate() + 1, prng),
  postId: localPhotosPost.id,
  type: AttachmentType.Image,
  original: base32ify("tapir2.jpg"),
  alt: "Photo 2",
}, {
  id: ulid(localPhotosPost.createdAt.getDate() + 2, prng),
  postId: localPhotosPost.id,
  type: AttachmentType.Image,
  original: base32ify("tapir3.jpg"),
  alt: "Photo 3",
}, {
  id: ulid(localPhotosPost.createdAt.getDate() + 3, prng),
  postId: localPhotosPost.id,
  type: AttachmentType.Image,
  original: base32ify("tapir4.jpg"),
  alt: "Photo 4",
}, {
  id: ulid(localVideoPost.createdAt.getDate(), prng),
  postId: localVideoPost.id,
  type: AttachmentType.Video,
  original: base32ify("tapir-video1.mp4"),
  alt: "Tapir video",
}];

export const PROFILE_TRUST: Readonly<
  Partial<Record<MockRemoteProfile, ProfileTrust>>
> = {
  [MockRemoteProfile.FRIENDLY_REDPANDA]: {
    addr: parseProtoAddr(MockRemoteProfile.FRIENDLY_REDPANDA),
    ...TRUST_LEVEL_TRUSTED,
  },
  [MockRemoteProfile.FRIENDLY_PARROT]: {
    addr: parseProtoAddr(MockRemoteProfile.FRIENDLY_PARROT),
    ...TRUST_LEVEL_TRUSTED,
  },
  [MockRemoteProfile.FRIENDLY_SLOTH]: {
    addr: parseProtoAddr(MockRemoteProfile.FRIENDLY_SLOTH),
    ...TRUST_LEVEL_TRUSTED,
  },
  [MockRemoteProfile.FRIENDLY_MONKEY]: {
    addr: parseProtoAddr(MockRemoteProfile.FRIENDLY_MONKEY),
    ...TRUST_LEVEL_TRUSTED,
  },
  [MockRemoteProfile.FRIENDLY_ARMADILLO]: {
    addr: parseProtoAddr(MockRemoteProfile.FRIENDLY_ARMADILLO),
    ...TRUST_LEVEL_TRUSTED,
  },
  [MockRemoteProfile.FRIENDLY_BLOCKED]: {
    addr: parseProtoAddr(MockRemoteProfile.FRIENDLY_BLOCKED),
    ...TRUST_LEVEL_BLOCKED,
  },

  [MockRemoteProfile.FAMILIAR_BADGER]: {
    addr: parseProtoAddr(MockRemoteProfile.FAMILIAR_BADGER),
    ...TRUST_LEVEL_TRUSTED,
  },
  [MockRemoteProfile.FAMILIAR_BEAR]: {
    addr: parseProtoAddr(MockRemoteProfile.FAMILIAR_BEAR),
    ...TRUST_LEVEL_TRUSTED,
  },
  [MockRemoteProfile.FAMILIAR_BLOCKED]: {
    addr: parseProtoAddr(MockRemoteProfile.FAMILIAR_BLOCKED),
    ...TRUST_LEVEL_BLOCKED,
  },

  [MockRemoteProfile.UNFAMILIAR_BLOCKED]: {
    addr: parseProtoAddr(MockRemoteProfile.UNFAMILIAR_BLOCKED),
    ...TRUST_LEVEL_BLOCKED,
  },

  [MockRemoteProfile.SEMI_BLOCKED_TRUSTED]: {
    addr: parseProtoAddr(MockRemoteProfile.SEMI_BLOCKED_TRUSTED),
    ...TRUST_LEVEL_TRUSTED,
  },
};

let nextInFollowId = 1;
const inFollow = (persona: MockPersonaName, profile: MockRemoteProfile) => ({
  id: nextInFollowId++,
  persona,
  remoteProfile: parseProtoAddr(profile),
  createdAt: ago({ weeks: 1 }),
  acceptedAt: ago({ weeks: 1 }),
  public: true,
});

export const IN_FOLLOWS: Readonly<
  Record<MockPersonaName, readonly InFollow[]>
> = {
  [MockPersonaName.MAIN]: [
    inFollow(MockPersonaName.MAIN, MockRemoteProfile.FRIENDLY_REDPANDA),
    inFollow(MockPersonaName.MAIN, MockRemoteProfile.FRIENDLY_PARROT),
    inFollow(MockPersonaName.MAIN, MockRemoteProfile.FRIENDLY_SLOTH),
    inFollow(MockPersonaName.MAIN, MockRemoteProfile.FRIENDLY_MONKEY),
    inFollow(MockPersonaName.MAIN, MockRemoteProfile.FRIENDLY_ARMADILLO),
    inFollow(MockPersonaName.MAIN, MockRemoteProfile.FAMILIAR_BADGER),
    inFollow(MockPersonaName.MAIN, MockRemoteProfile.SEMI_BLOCKED_TRUSTED),
  ],
  [MockPersonaName.BLOG]: [
    inFollow(MockPersonaName.MAIN, MockRemoteProfile.FRIENDLY_REDPANDA),
    inFollow(MockPersonaName.MAIN, MockRemoteProfile.FRIENDLY_SLOTH),
    inFollow(MockPersonaName.MAIN, MockRemoteProfile.FAMILIAR_BADGER),
  ],
  [MockPersonaName.SECRET]: [
    inFollow(MockPersonaName.MAIN, MockRemoteProfile.FRIENDLY_SLOTH),
    inFollow(MockPersonaName.MAIN, MockRemoteProfile.FAMILIAR_BADGER),
    inFollow(MockPersonaName.MAIN, MockRemoteProfile.FAMILIAR_HORSE),
  ],
};

export const LOCAL_MEDIA: readonly Omit<Media, "data" | "bytes">[] = [{
  hash: "tapir-avatar.webp",
  mimetype: "image/webp",
}, {
  hash: "tapir1.jpg",
  mimetype: "image/jpeg",
}, {
  hash: "tapir2.jpg",
  mimetype: "image/jpeg",
}, {
  hash: "tapir3.jpg",
  mimetype: "image/jpeg",
}, {
  hash: "tapir4.jpg",
  mimetype: "image/jpeg",
}, {
  hash: "tapir5.jpg",
  mimetype: "image/jpeg",
}, {
  hash: "tapir-video1.mp4",
  mimetype: "video/mp4",
}].map((x) => ({
  ...x,
  hash: base32ify(x.hash),
  createdAt: ago({ weeks: 1 }),
}));

export const REMOTE_MEDIA: readonly Omit<RemoteMedia, "data" | "bytes">[] = [{
  hash: "antelope-avatar.webp",
  mimetype: "image/webp",
  domain: MockDomain.UNFAMILIAR,
}, {
  hash: "armadillo-avatar.webp",
  mimetype: "image/webp",
  domain: MockDomain.FRIENDLY,
}, {
  hash: "badger-avatar.webp",
  mimetype: "image/webp",
  domain: MockDomain.FAMILIAR,
}, {
  hash: "bear-avatar.webp",
  mimetype: "image/webp",
  domain: MockDomain.FAMILIAR,
}, {
  hash: "elephant-avatar.webp",
  mimetype: "image/webp",
  domain: MockDomain.UNFAMILIAR,
}, {
  hash: "horse-avatar.webp",
  mimetype: "image/webp",
  domain: MockDomain.FAMILIAR,
}, {
  hash: "hyena-avatar.webp",
  mimetype: "image/webp",
  domain: MockDomain.UNFAMILIAR,
}, {
  hash: "lemur-avatar.webp",
  mimetype: "image/webp",
  domain: MockDomain.UNFAMILIAR,
}, {
  hash: "monkey-avatar.webp",
  mimetype: "image/webp",
  domain: MockDomain.FRIENDLY,
}, {
  hash: "mouse-avatar.webp",
  mimetype: "image/webp",
  domain: MockDomain.FAMILIAR,
}, {
  hash: "parrot-avatar.webp",
  mimetype: "image/webp",
  domain: MockDomain.FRIENDLY,
}, {
  hash: "raccoon-avatar.webp",
  mimetype: "image/webp",
  domain: MockDomain.FAMILIAR,
}, {
  hash: "redpanda-avatar.webp",
  mimetype: "image/webp",
  domain: MockDomain.FRIENDLY,
}, {
  hash: "sloth-avatar.webp",
  mimetype: "image/webp",
  domain: MockDomain.FRIENDLY,
}, {
  hash: "zebra-avatar.webp",
  mimetype: "image/webp",
  domain: MockDomain.UNFAMILIAR,
}, {
  hash: "antelope1.jpg",
  mimetype: "image/jpeg",
  domain: MockDomain.UNFAMILIAR,
}, {
  hash: "armadillo1.jpg",
  mimetype: "image/jpeg",
  domain: MockDomain.FRIENDLY,
}, {
  hash: "badger1.jpg",
  mimetype: "image/jpeg",
  domain: MockDomain.FAMILIAR,
}, {
  hash: "bear1.jpg",
  mimetype: "image/jpeg",
  domain: MockDomain.FAMILIAR,
}, {
  hash: "elephant1.jpg",
  mimetype: "image/jpeg",
  domain: MockDomain.UNFAMILIAR,
}, {
  hash: "elephant2.jpg",
  mimetype: "image/jpeg",
  domain: MockDomain.UNFAMILIAR,
}, {
  hash: "elephant3.jpg",
  mimetype: "image/jpeg",
  domain: MockDomain.UNFAMILIAR,
}, {
  hash: "horse1.jpg",
  mimetype: "image/jpeg",
  domain: MockDomain.FAMILIAR,
}, {
  hash: "hyena1.jpg",
  mimetype: "image/jpeg",
  domain: MockDomain.UNFAMILIAR,
}, {
  hash: "jungle1.jpg",
  mimetype: "image/jpeg",
  domain: MockDomain.FRIENDLY,
}, {
  hash: "jungle2.jpg",
  mimetype: "image/jpeg",
  domain: MockDomain.UNFAMILIAR,
}, {
  hash: "lemur1.jpg",
  mimetype: "image/jpeg",
  domain: MockDomain.UNFAMILIAR,
}, {
  hash: "lemur2.jpg",
  mimetype: "image/jpeg",
  domain: MockDomain.UNFAMILIAR,
}, {
  hash: "monkey1.jpg",
  mimetype: "image/jpeg",
  domain: MockDomain.FRIENDLY,
}, {
  hash: "mouse1.jpg",
  mimetype: "image/jpeg",
  domain: MockDomain.FAMILIAR,
}, {
  hash: "parrot1.jpg",
  mimetype: "image/jpeg",
  domain: MockDomain.FRIENDLY,
}, {
  hash: "raccoon1.jpg",
  mimetype: "image/jpeg",
  domain: MockDomain.FAMILIAR,
}, {
  hash: "raccoon2.jpg",
  mimetype: "image/jpeg",
  domain: MockDomain.FAMILIAR,
}, {
  hash: "redpanda1.jpg",
  mimetype: "image/jpeg",
  domain: MockDomain.FRIENDLY,
}, {
  hash: "redpanda2.jpg",
  mimetype: "image/jpeg",
  domain: MockDomain.FRIENDLY,
}, {
  hash: "redpanda3.jpg",
  mimetype: "image/jpeg",
  domain: MockDomain.FRIENDLY,
}, {
  hash: "redpanda4.jpg",
  mimetype: "image/jpeg",
  domain: MockDomain.FRIENDLY,
}, {
  hash: "sloth1.jpg",
  mimetype: "image/jpeg",
  domain: MockDomain.FRIENDLY,
}, {
  hash: "sloth2.jpg",
  mimetype: "image/jpeg",
  domain: MockDomain.FRIENDLY,
}, {
  hash: "sloth3.jpg",
  mimetype: "image/jpeg",
  domain: MockDomain.FRIENDLY,
}, {
  hash: "zebra1.jpg",
  mimetype: "image/jpeg",
  domain: MockDomain.UNFAMILIAR,
}, {
  hash: "tapir-video2.mp4",
  mimetype: "video/mp4",
  domain: MockDomain.FRIENDLY,
}].map((x) => ({
  ...x,
  hash: base32ify(x.hash),
  createdAt: ago({ weeks: 1 }),
  url: `http://${x.domain}/images/${x.hash}`,
  domain: normalizeDomain(x.domain),
}));

export const REMOTE_INSTANCES: Readonly<
  Omit<Record<MockDomain, RemoteInstance>, MockDomain.LOCAL>
> = {
  [MockDomain.FRIENDLY]: {
    url: `https://${MockDomain.FRIENDLY}`,
    displayName: "Friendly Server",
    shortDescription: "Mostly followers and mutuals",
    description: "Mostly followers and mutuals",
    software: "mastodon",
    softwareVersion: "4.1.2",
    lastSeen: ago({ second: 1 }),
    instanceMetadata: {
      protocols: {
        [Protocol.ActivityPub]: true,
        [Protocol.Mastodon]: true,
      },
      feeds: SOFTWARE_FEATURES.mastodon.feeds,
      features: SOFTWARE_FEATURES.mastodon.features[0].flags,
      defaultStyle: SOFTWARE_FEATURES.mastodon.defaultStyle,
      admins: [parseProtoAddr(MockRemoteProfile.FRIENDLY_REDPANDA)],
    },
  },
  [MockDomain.FAMILIAR]: {
    url: `https://${MockDomain.FAMILIAR}`,
    displayName: "Familiar Server",
    shortDescription: "Some users you know and some you don't",
    description: "Some users you know and some you don't",
    software: "pleroma",
    softwareVersion: "2.1",
    lastSeen: ago({ second: 1 }),
    instanceMetadata: {
      protocols: {
        [Protocol.ActivityPub]: true,
        [Protocol.Mastodon]: true,
      },
      feeds: SOFTWARE_FEATURES.pleroma.feeds,
      features: SOFTWARE_FEATURES.pleroma.features[0].flags,
      defaultStyle: SOFTWARE_FEATURES.pleroma.defaultStyle,
      admins: [parseProtoAddr(MockRemoteProfile.FAMILIAR_BADGER)],
    },
  },
  [MockDomain.UNFAMILIAR]: {
    url: `https://${MockDomain.UNFAMILIAR}`,
    displayName: "Unfamiliar Server",
    shortDescription: "No one on this server has a direct connection to you",
    description: "No one on this server has a direct connection to you",
    software: "calckey",
    softwareVersion: "14.0.0",
    lastSeen: ago({ second: 1 }),
    instanceMetadata: {
      protocols: {
        [Protocol.ActivityPub]: true,
      },
      feeds: SOFTWARE_FEATURES.calckey.feeds,
      features: SOFTWARE_FEATURES.calckey.features[0].flags,
      defaultStyle: SOFTWARE_FEATURES.calckey.defaultStyle,
      admins: [parseProtoAddr(MockRemoteProfile.UNFAMILIAR_ELEPHANT)],
    },
  },
  [MockDomain.SEMI_BLOCKED]: {
    url: `https://${MockDomain.SEMI_BLOCKED}`,
    displayName: "Semi-Blocked Server",
    shortDescription: "A blocked server with one user you trust",
    description: "A blocked server with one user you trust",
    software: "mastodon",
    softwareVersion: "4.1.2",
    lastSeen: ago({ second: 1 }),
    instanceMetadata: {
      protocols: {
        [Protocol.ActivityPub]: true,
        [Protocol.Mastodon]: true,
      },
      feeds: SOFTWARE_FEATURES.mastodon.feeds,
      features: SOFTWARE_FEATURES.mastodon.features[0].flags,
      defaultStyle: SOFTWARE_FEATURES.mastodon.defaultStyle,
      admins: [parseProtoAddr(MockRemoteProfile.SEMI_BLOCKED_UNTRUSTED)],
    },
  },
  [MockDomain.BLOCKED]: {
    url: `https://${MockDomain.BLOCKED}`,
    displayName: "Blocked Server",
    shortDescription: "here be goons",
    description: "here be goons",
    software: "pleroma",
    softwareVersion: "2.1",
    lastSeen: ago({ second: 1 }),
    instanceMetadata: {
      protocols: {
        [Protocol.ActivityPub]: true,
        [Protocol.Mastodon]: true,
      },
      feeds: SOFTWARE_FEATURES.pleroma.feeds,
      features: SOFTWARE_FEATURES.pleroma.features[0].flags,
      defaultStyle: SOFTWARE_FEATURES.pleroma.defaultStyle,
      admins: [parseProtoAddr(MockRemoteProfile.BLOCKED_GOON)],
    },
  },
};

const profileDefaults = (profile: string) => {
  const addr = parseProtoAddr(profile);
  return {
    addr: addr,
    instance: protoAddrInstance(addr, TAPIR_CONFIG),
    url: addr.path,
    profile,
    canonical: true,
    type: ProfileType.Person,
    apInbox: urlJoin(addr.path, "/inbox"),
    lastSeen: ago({ hour: 1 }),
    followingCount: 0,
    followerCount: 0,
    postCount: 0,
    requestToFollow: false,
    createdAt: ago({ weeks: 1 }),
  } as const;
};

export const REMOTE_PROFILES: Readonly<
  Omit<
    Record<MockRemoteProfile, RemoteProfile>,
    | MockRemoteProfile.LOCAL_MAIN
    | MockRemoteProfile.LOCAL_BLOG
    | MockRemoteProfile.LOCAL_SECRET
  >
> = {
  [MockRemoteProfile.FRIENDLY_REDPANDA]: {
    ...profileDefaults(MockRemoteProfile.FRIENDLY_REDPANDA),
    name: "redpanda",
    displayName: "Red Panda",
    summaryHtml: "red panda is best panda",
    avatarUrl: `https://${MockDomain.FRIENDLY}/images/redpanda-avatar.webp`,
    bannerUrl: `https://${MockDomain.FRIENDLY}/images/jungle1.jpg`,
    apSharedInbox: `https://${MockDomain.FRIENDLY}/sharedInbox`,
  },
  [MockRemoteProfile.FRIENDLY_PARROT]: {
    ...profileDefaults(MockRemoteProfile.FRIENDLY_PARROT),
    name: "parrot",
    displayName: "Parrot",
    summaryHtml: "polly want a cracker",
    avatarUrl: `https://${MockDomain.FRIENDLY}/images/parrot-avatar.webp`,
    apSharedInbox: `https://${MockDomain.FRIENDLY}/sharedInbox`,
  },
  [MockRemoteProfile.FRIENDLY_SLOTH]: {
    ...profileDefaults(MockRemoteProfile.FRIENDLY_SLOTH),
    name: "sloth",
    displayName: "Sloth",
    summaryHtml: "i'll write a bio eventually",
    avatarUrl: `https://${MockDomain.FRIENDLY}/images/sloth-avatar.webp`,
    apSharedInbox: `https://${MockDomain.FRIENDLY}/sharedInbox`,
  },
  [MockRemoteProfile.FRIENDLY_MONKEY]: {
    ...profileDefaults(MockRemoteProfile.FRIENDLY_MONKEY),
    name: "monkey",
    displayName: "Monkey",
    summaryHtml: "got any bananas?",
    avatarUrl: `https://${MockDomain.FRIENDLY}/images/monkey-avatar.webp`,
    apSharedInbox: `https://${MockDomain.FRIENDLY}/sharedInbox`,
  },
  [MockRemoteProfile.FRIENDLY_ARMADILLO]: {
    ...profileDefaults(MockRemoteProfile.FRIENDLY_ARMADILLO),
    name: "armadillo",
    displayName: "Armadillo",
    avatarUrl: `https://${MockDomain.FRIENDLY}/images/armadillo-avatar.webp`,
    apSharedInbox: `https://${MockDomain.FRIENDLY}/sharedInbox`,
  },
  [MockRemoteProfile.FRIENDLY_BLOCKED]: {
    ...profileDefaults(MockRemoteProfile.FRIENDLY_BLOCKED),
    name: "blocked",
    displayName: "Blocked User from Friendly Server",
    summaryHtml: "This user shouldn't show up in feeds.",
    apSharedInbox: `https://${MockDomain.FRIENDLY}/sharedInbox`,
  },

  [MockRemoteProfile.FAMILIAR_BADGER]: {
    ...profileDefaults(MockRemoteProfile.FAMILIAR_BADGER),
    name: "badger",
    displayName: "Badger",
    summaryHtml: "MUSHROOM MUSHROOM",
    avatarUrl: `https://${MockDomain.FAMILIAR}/images/badger-avatar.webp`,
  },
  [MockRemoteProfile.FAMILIAR_BEAR]: {
    ...profileDefaults(MockRemoteProfile.FAMILIAR_BEAR),
    name: "bear",
    displayName: "Bear",
    avatarUrl: `https://${MockDomain.FAMILIAR}/images/bear-avatar.webp`,
  },
  [MockRemoteProfile.FAMILIAR_MOUSE]: {
    ...profileDefaults(MockRemoteProfile.FAMILIAR_MOUSE),
    name: "mouse",
    displayName: "Mouse",
    avatarUrl: `https://${MockDomain.FAMILIAR}/images/mouse-avatar.webp`,
  },
  [MockRemoteProfile.FAMILIAR_RACCOON]: {
    ...profileDefaults(MockRemoteProfile.FAMILIAR_RACCOON),
    name: "raccoon",
    displayName: "Raccoon",
    summaryHtml: "Friendly neighborhood trash panda",
    avatarUrl: `https://${MockDomain.FAMILIAR}/images/raccoon-avatar.webp`,
  },
  [MockRemoteProfile.FAMILIAR_HORSE]: {
    ...profileDefaults(MockRemoteProfile.FAMILIAR_HORSE),
    name: "horse",
    displayName: "Horse",
    summaryHtml: "Everything happens so much",
    avatarUrl: `https://${MockDomain.FAMILIAR}/images/horse-avatar.webp`,
  },
  [MockRemoteProfile.FAMILIAR_BLOCKED]: {
    ...profileDefaults(MockRemoteProfile.FAMILIAR_BLOCKED),
    name: "blocked",
    displayName: "Blocked User from Familiar Server",
    summaryHtml: "This user shouldn't show up in feeds.",
  },

  [MockRemoteProfile.UNFAMILIAR_ANTELOPE]: {
    ...profileDefaults(MockRemoteProfile.UNFAMILIAR_ANTELOPE),
    name: "antelope",
    displayName: "Antelope",
    avatarUrl: `https://${MockDomain.UNFAMILIAR}/images/antelope-avatar.webp`,
  },
  [MockRemoteProfile.UNFAMILIAR_LEMUR]: {
    ...profileDefaults(MockRemoteProfile.UNFAMILIAR_LEMUR),
    name: "lemur",
    displayName: "Lemur",
    summaryHtml: "MOVE IT",
    avatarUrl: `https://${MockDomain.UNFAMILIAR}/images/lemur-avatar.webp`,
  },
  [MockRemoteProfile.UNFAMILIAR_ELEPHANT]: {
    ...profileDefaults(MockRemoteProfile.UNFAMILIAR_ELEPHANT),
    name: "elephant",
    displayName: "Elephant",
    summaryHtml: "I never forget. And I never forgive.",
    avatarUrl: `https://${MockDomain.UNFAMILIAR}/images/elephant-avatar.webp`,
  },
  [MockRemoteProfile.UNFAMILIAR_HYENA]: {
    ...profileDefaults(MockRemoteProfile.UNFAMILIAR_HYENA),
    name: "hyena",
    displayName: "Hyena",
    avatarUrl: `https://${MockDomain.UNFAMILIAR}/images/hyena-avatar.webp`,
  },
  [MockRemoteProfile.UNFAMILIAR_ZEBRA]: {
    ...profileDefaults(MockRemoteProfile.UNFAMILIAR_ZEBRA),
    name: "zebra",
    displayName: "Zebra",
    avatarUrl: `https://${MockDomain.UNFAMILIAR}/images/zebra-avatar.webp`,
  },
  [MockRemoteProfile.UNFAMILIAR_BLOCKED]: {
    ...profileDefaults(MockRemoteProfile.UNFAMILIAR_BLOCKED),
    name: "blocked",
    displayName: "Blocked User from Unfamiliar Server",
    summaryHtml: "This user shouldn't show up in feeds.",
  },

  [MockRemoteProfile.SEMI_BLOCKED_TRUSTED]: {
    ...profileDefaults(MockRemoteProfile.SEMI_BLOCKED_TRUSTED),
    name: "trusted",
    displayName: "Trusted User from Blocked Server",
  },
  [MockRemoteProfile.SEMI_BLOCKED_UNTRUSTED]: {
    ...profileDefaults(MockRemoteProfile.SEMI_BLOCKED_UNTRUSTED),
    name: "untrusted",
    displayName: "Untrusted User from Blocked Server",
  },

  [MockRemoteProfile.BLOCKED_GOON]: {
    ...profileDefaults(MockRemoteProfile.BLOCKED_GOON),
    name: "goon",
    displayName: "A Reprehensible Goon",
    summaryHtml: "Block me! Block me!",
  },
};

export const REMOTE_FOLLOWS: Readonly<
  Omit<
    Record<MockRemoteProfile, readonly MockRemoteProfile[]>,
    | MockRemoteProfile.LOCAL_MAIN
    | MockRemoteProfile.LOCAL_BLOG
    | MockRemoteProfile.LOCAL_SECRET
  >
> = {
  [MockRemoteProfile.FRIENDLY_REDPANDA]: [
    MockRemoteProfile.LOCAL_MAIN,
    MockRemoteProfile.LOCAL_BLOG,
    MockRemoteProfile.FRIENDLY_PARROT,
    MockRemoteProfile.FRIENDLY_SLOTH,
    MockRemoteProfile.FRIENDLY_MONKEY,
    MockRemoteProfile.FRIENDLY_ARMADILLO,
    MockRemoteProfile.FRIENDLY_BLOCKED,
    MockRemoteProfile.FAMILIAR_BADGER,
    MockRemoteProfile.UNFAMILIAR_ELEPHANT,
    MockRemoteProfile.UNFAMILIAR_LEMUR,
  ],
  [MockRemoteProfile.FRIENDLY_PARROT]: [
    MockRemoteProfile.LOCAL_MAIN,
    MockRemoteProfile.FRIENDLY_REDPANDA,
    MockRemoteProfile.FRIENDLY_SLOTH,
    MockRemoteProfile.FRIENDLY_MONKEY,
    MockRemoteProfile.FRIENDLY_ARMADILLO,
    MockRemoteProfile.FRIENDLY_BLOCKED,
    MockRemoteProfile.FAMILIAR_BADGER,
    MockRemoteProfile.FAMILIAR_BEAR,
    MockRemoteProfile.FAMILIAR_HORSE,
    MockRemoteProfile.FAMILIAR_BLOCKED,
    MockRemoteProfile.UNFAMILIAR_LEMUR,
    MockRemoteProfile.UNFAMILIAR_HYENA,
    MockRemoteProfile.SEMI_BLOCKED_TRUSTED,
    MockRemoteProfile.SEMI_BLOCKED_UNTRUSTED,
  ],
  [MockRemoteProfile.FRIENDLY_SLOTH]: [
    MockRemoteProfile.LOCAL_MAIN,
    MockRemoteProfile.LOCAL_BLOG,
    MockRemoteProfile.LOCAL_SECRET,
    MockRemoteProfile.FRIENDLY_REDPANDA,
    MockRemoteProfile.UNFAMILIAR_ELEPHANT,
  ],
  [MockRemoteProfile.FRIENDLY_MONKEY]: [
    MockRemoteProfile.LOCAL_MAIN,
    MockRemoteProfile.FRIENDLY_REDPANDA,
    MockRemoteProfile.FRIENDLY_ARMADILLO,
    MockRemoteProfile.FRIENDLY_BLOCKED,
    MockRemoteProfile.FAMILIAR_BADGER,
    MockRemoteProfile.FAMILIAR_BEAR,
    MockRemoteProfile.FAMILIAR_RACCOON,
    MockRemoteProfile.UNFAMILIAR_LEMUR,
    MockRemoteProfile.SEMI_BLOCKED_TRUSTED,
  ],
  [MockRemoteProfile.FRIENDLY_ARMADILLO]: [
    MockRemoteProfile.LOCAL_MAIN,
    MockRemoteProfile.FRIENDLY_REDPANDA,
    MockRemoteProfile.FRIENDLY_PARROT,
    MockRemoteProfile.FRIENDLY_MONKEY,
    MockRemoteProfile.FAMILIAR_BEAR,
    MockRemoteProfile.FAMILIAR_RACCOON,
    MockRemoteProfile.UNFAMILIAR_ANTELOPE,
    MockRemoteProfile.UNFAMILIAR_ZEBRA,
  ],
  [MockRemoteProfile.FRIENDLY_BLOCKED]: [
    MockRemoteProfile.FRIENDLY_REDPANDA,
    MockRemoteProfile.FRIENDLY_PARROT,
    MockRemoteProfile.FRIENDLY_SLOTH,
    MockRemoteProfile.FRIENDLY_MONKEY,
    MockRemoteProfile.FRIENDLY_ARMADILLO,
    MockRemoteProfile.FAMILIAR_BLOCKED,
    MockRemoteProfile.UNFAMILIAR_LEMUR,
    MockRemoteProfile.UNFAMILIAR_HYENA,
    MockRemoteProfile.UNFAMILIAR_BLOCKED,
    MockRemoteProfile.SEMI_BLOCKED_TRUSTED,
    MockRemoteProfile.SEMI_BLOCKED_UNTRUSTED,
  ],

  [MockRemoteProfile.FAMILIAR_BADGER]: [
    MockRemoteProfile.LOCAL_MAIN,
    MockRemoteProfile.LOCAL_BLOG,
    MockRemoteProfile.LOCAL_SECRET,
    MockRemoteProfile.FRIENDLY_REDPANDA,
    MockRemoteProfile.FRIENDLY_MONKEY,
    MockRemoteProfile.FAMILIAR_BEAR,
    MockRemoteProfile.FAMILIAR_RACCOON,
    MockRemoteProfile.FAMILIAR_HORSE,
    MockRemoteProfile.FAMILIAR_BLOCKED,
    MockRemoteProfile.UNFAMILIAR_ELEPHANT,
    MockRemoteProfile.SEMI_BLOCKED_UNTRUSTED,
  ],
  [MockRemoteProfile.FAMILIAR_BEAR]: [
    MockRemoteProfile.FRIENDLY_MONKEY,
    MockRemoteProfile.FRIENDLY_ARMADILLO,
    MockRemoteProfile.FAMILIAR_BADGER,
    MockRemoteProfile.FAMILIAR_RACCOON,
    MockRemoteProfile.UNFAMILIAR_ELEPHANT,
    MockRemoteProfile.UNFAMILIAR_HYENA,
  ],
  [MockRemoteProfile.FAMILIAR_MOUSE]: [
    // Not followed by anyone, intentionally.
    MockRemoteProfile.FAMILIAR_BADGER,
  ],
  [MockRemoteProfile.FAMILIAR_RACCOON]: [
    MockRemoteProfile.FRIENDLY_PARROT,
    MockRemoteProfile.FRIENDLY_ARMADILLO,
    MockRemoteProfile.FRIENDLY_BLOCKED,
    MockRemoteProfile.FAMILIAR_BADGER,
    MockRemoteProfile.FAMILIAR_BEAR,
    MockRemoteProfile.FAMILIAR_HORSE,
    MockRemoteProfile.FAMILIAR_BLOCKED,
    MockRemoteProfile.UNFAMILIAR_HYENA,
    MockRemoteProfile.UNFAMILIAR_LEMUR,
    MockRemoteProfile.UNFAMILIAR_BLOCKED,
    MockRemoteProfile.SEMI_BLOCKED_TRUSTED,
    MockRemoteProfile.SEMI_BLOCKED_UNTRUSTED,
    MockRemoteProfile.BLOCKED_GOON,
  ],
  [MockRemoteProfile.FAMILIAR_HORSE]: [
    MockRemoteProfile.LOCAL_SECRET,
    MockRemoteProfile.FRIENDLY_PARROT,
  ],
  [MockRemoteProfile.FAMILIAR_BLOCKED]: [
    MockRemoteProfile.FRIENDLY_PARROT,
    MockRemoteProfile.FRIENDLY_BLOCKED,
    MockRemoteProfile.FAMILIAR_BADGER,
    MockRemoteProfile.FAMILIAR_RACCOON,
    MockRemoteProfile.FAMILIAR_BLOCKED,
    MockRemoteProfile.UNFAMILIAR_ANTELOPE,
    MockRemoteProfile.UNFAMILIAR_BLOCKED,
  ],

  [MockRemoteProfile.UNFAMILIAR_ELEPHANT]: [
    MockRemoteProfile.FRIENDLY_REDPANDA,
    MockRemoteProfile.FAMILIAR_BADGER,
    MockRemoteProfile.UNFAMILIAR_LEMUR,
  ],
  [MockRemoteProfile.UNFAMILIAR_ANTELOPE]: [
    // Doesn't follow anyone, intentionally.
  ],
  [MockRemoteProfile.UNFAMILIAR_HYENA]: [
    MockRemoteProfile.FAMILIAR_BADGER,
    MockRemoteProfile.FAMILIAR_BEAR,
    MockRemoteProfile.FAMILIAR_RACCOON,
    MockRemoteProfile.FRIENDLY_BLOCKED,
    MockRemoteProfile.UNFAMILIAR_BLOCKED,
    MockRemoteProfile.SEMI_BLOCKED_TRUSTED,
    MockRemoteProfile.SEMI_BLOCKED_UNTRUSTED,
    MockRemoteProfile.BLOCKED_GOON,
  ],
  [MockRemoteProfile.UNFAMILIAR_LEMUR]: [
    MockRemoteProfile.FRIENDLY_REDPANDA,
    MockRemoteProfile.FRIENDLY_SLOTH,
    MockRemoteProfile.FRIENDLY_MONKEY,
    MockRemoteProfile.FAMILIAR_BADGER,
    MockRemoteProfile.UNFAMILIAR_ELEPHANT,
    MockRemoteProfile.UNFAMILIAR_ANTELOPE,
    MockRemoteProfile.UNFAMILIAR_ZEBRA,
  ],
  [MockRemoteProfile.UNFAMILIAR_ZEBRA]: [
    MockRemoteProfile.FAMILIAR_HORSE,
    MockRemoteProfile.FAMILIAR_RACCOON,
    MockRemoteProfile.UNFAMILIAR_ELEPHANT,
    MockRemoteProfile.UNFAMILIAR_ANTELOPE,
    MockRemoteProfile.UNFAMILIAR_HYENA,
    MockRemoteProfile.UNFAMILIAR_LEMUR,
    MockRemoteProfile.UNFAMILIAR_BLOCKED,
  ],
  [MockRemoteProfile.UNFAMILIAR_BLOCKED]: [
    MockRemoteProfile.FRIENDLY_BLOCKED,
    MockRemoteProfile.FAMILIAR_BLOCKED,
    MockRemoteProfile.UNFAMILIAR_ELEPHANT,
    MockRemoteProfile.UNFAMILIAR_HYENA,
    MockRemoteProfile.SEMI_BLOCKED_UNTRUSTED,
    MockRemoteProfile.BLOCKED_GOON,
  ],

  [MockRemoteProfile.SEMI_BLOCKED_TRUSTED]: [
    MockRemoteProfile.LOCAL_MAIN,
    MockRemoteProfile.FRIENDLY_PARROT,
    MockRemoteProfile.FRIENDLY_SLOTH,
    MockRemoteProfile.FRIENDLY_BLOCKED,
    MockRemoteProfile.FAMILIAR_BADGER,
    MockRemoteProfile.FAMILIAR_HORSE,
    MockRemoteProfile.FAMILIAR_RACCOON,
    MockRemoteProfile.UNFAMILIAR_HYENA,
    MockRemoteProfile.SEMI_BLOCKED_UNTRUSTED,
  ],
  [MockRemoteProfile.SEMI_BLOCKED_UNTRUSTED]: [
    MockRemoteProfile.FAMILIAR_RACCOON,
    MockRemoteProfile.UNFAMILIAR_HYENA,
    MockRemoteProfile.UNFAMILIAR_BLOCKED,
    MockRemoteProfile.SEMI_BLOCKED_TRUSTED,
    MockRemoteProfile.BLOCKED_GOON,
  ],

  [MockRemoteProfile.BLOCKED_GOON]: [
    MockRemoteProfile.FAMILIAR_RACCOON,
    MockRemoteProfile.FAMILIAR_BLOCKED,
    MockRemoteProfile.UNFAMILIAR_BLOCKED,
    MockRemoteProfile.SEMI_BLOCKED_TRUSTED,
    MockRemoteProfile.SEMI_BLOCKED_UNTRUSTED,
  ],
};

function postDefaults(owner: string, id: string) {
  const profile = parseProtoAddr(owner);
  return {
    addr: { protocol: profile.protocol, path: urlJoin(owner, `/status/${id}`) },
    profile,
    canonical: true,
    sensitive: false,
    type: PostType.Note,
    proxies: [],
    tags: [],
    mentions: [],
    attachments: [],
    emoji: [],
  } as const;
}

function loremPosts(owner: string, count = 3) {
  const posts = [];
  for (let i = count; i > 0; i--) {
    const createdAt = ago({
        day: i,
        hour: vegas.randomInt(0, 4),
        minute: vegas.randomInt(0, 60),
      }),
      id = `${count - i + 1}`;
    posts.push({
      ...postDefaults(owner, id),
      contentHtml: lorem.generateParagraphs(1),
      createdAt,
    });
  }
  return posts;
}

export const REMOTE_POSTS: Readonly<
  Omit<
    Record<MockRemoteProfile, readonly RemotePostFull[]>,
    | MockRemoteProfile.LOCAL_MAIN
    | MockRemoteProfile.LOCAL_BLOG
    | MockRemoteProfile.LOCAL_SECRET
  >
> = {
  [MockRemoteProfile.FRIENDLY_REDPANDA]: loremPosts(
    MockRemoteProfile.FRIENDLY_REDPANDA,
  ),
  [MockRemoteProfile.FRIENDLY_PARROT]: loremPosts(
    MockRemoteProfile.FRIENDLY_PARROT,
  ),
  [MockRemoteProfile.FRIENDLY_SLOTH]: loremPosts(
    MockRemoteProfile.FRIENDLY_SLOTH,
  ),
  [MockRemoteProfile.FRIENDLY_MONKEY]: loremPosts(
    MockRemoteProfile.FRIENDLY_MONKEY,
  ),
  [MockRemoteProfile.FRIENDLY_ARMADILLO]: loremPosts(
    MockRemoteProfile.FRIENDLY_ARMADILLO,
  ),
  [MockRemoteProfile.FRIENDLY_BLOCKED]: [{
    ...postDefaults(MockRemoteProfile.FRIENDLY_BLOCKED, "1"),
    createdAt: ago({ day: 1 }),
    contentHtml: "You shouldn't be able to see this post!",
  }],

  [MockRemoteProfile.FAMILIAR_BADGER]: loremPosts(
    MockRemoteProfile.FAMILIAR_BADGER,
  ),
  [MockRemoteProfile.FAMILIAR_BEAR]: loremPosts(
    MockRemoteProfile.FAMILIAR_BEAR,
  ),
  [MockRemoteProfile.FAMILIAR_MOUSE]: loremPosts(
    MockRemoteProfile.FAMILIAR_MOUSE,
  ),
  [MockRemoteProfile.FAMILIAR_RACCOON]: loremPosts(
    MockRemoteProfile.FAMILIAR_RACCOON,
  ),
  [MockRemoteProfile.FAMILIAR_HORSE]: loremPosts(
    MockRemoteProfile.FAMILIAR_HORSE,
  ),
  [MockRemoteProfile.FAMILIAR_BLOCKED]: [{
    ...postDefaults(MockRemoteProfile.FAMILIAR_BLOCKED, "1"),
    createdAt: ago({ day: 1 }),
    contentHtml: "You shouldn't be able to see this post!",
  }],

  [MockRemoteProfile.UNFAMILIAR_ANTELOPE]: loremPosts(
    MockRemoteProfile.UNFAMILIAR_ANTELOPE,
  ),
  [MockRemoteProfile.UNFAMILIAR_LEMUR]: loremPosts(
    MockRemoteProfile.UNFAMILIAR_LEMUR,
  ),
  [MockRemoteProfile.UNFAMILIAR_ELEPHANT]: loremPosts(
    MockRemoteProfile.UNFAMILIAR_ELEPHANT,
  ),
  [MockRemoteProfile.UNFAMILIAR_HYENA]: loremPosts(
    MockRemoteProfile.UNFAMILIAR_HYENA,
  ),
  [MockRemoteProfile.UNFAMILIAR_ZEBRA]: loremPosts(
    MockRemoteProfile.UNFAMILIAR_ZEBRA,
  ),
  [MockRemoteProfile.UNFAMILIAR_BLOCKED]: [{
    ...postDefaults(MockRemoteProfile.UNFAMILIAR_BLOCKED, "1"),
    createdAt: ago({ day: 1 }),
    contentHtml: "You shouldn't be able to see this post!",
  }],

  [MockRemoteProfile.SEMI_BLOCKED_TRUSTED]: loremPosts(
    MockRemoteProfile.SEMI_BLOCKED_TRUSTED,
  ),
  [MockRemoteProfile.SEMI_BLOCKED_UNTRUSTED]: [{
    ...postDefaults(MockRemoteProfile.SEMI_BLOCKED_UNTRUSTED, "1"),
    createdAt: ago({ day: 1 }),
    contentHtml: "You shouldn't be able to see this post!",
  }],

  [MockRemoteProfile.BLOCKED_GOON]: [{
    ...postDefaults(MockRemoteProfile.BLOCKED_GOON, "1"),
    createdAt: ago({ day: 1 }),
    contentHtml: "You shouldn't be able to see this post!",
  }],
};
