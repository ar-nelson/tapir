import {
  DisplayStyle,
  InstanceFeatures,
  ProtoAddr,
  Protocol,
} from "$/models/types.ts";

export interface SoftwareFeatures {
  readonly displayName: string;
  readonly defaultStyle: DisplayStyle;
  readonly icon?: string;
  readonly feeds?: readonly {
    readonly name: string;
    readonly addr: ProtoAddr;
  }[];
  features: readonly {
    readonly minVersion?: string;
    readonly versionSuffix?: string;
    readonly mastodonApi?: boolean;
    readonly pleromaApi?: boolean;
    readonly misskeyApi?: boolean;
    readonly flags: InstanceFeatures;
  }[];
}

export const DEFAULT_SOFTWARE_FEATURES: SoftwareFeatures = {
  displayName: "Unknown Software",
  defaultStyle: DisplayStyle.Microblog,
  features: [{
    flags: {
      like: true,
      boost: true,
      reply: true,
      follow: true,
    },
  }],
};

const mastodonFeeds = [
    {
      name: "Local Timeline",
      addr: {
        protocol: Protocol.Mastodon,
        path: "/api/v1/timelines/public?local=true",
      },
    },
    {
      name: "Federated Timeline",
      addr: { protocol: Protocol.Mastodon, path: "/api/v1/timelines/public" },
    },
  ],
  pleromaDefaults = {
    defaultStyle: DisplayStyle.Microblog,
    feeds: mastodonFeeds,
    features: [{
      mastodonApi: true,
      pleromaApi: true,
      flags: {
        emojiReact: true,
        boost: true,
        quotePost: true,
        reply: true,
        follow: true,
        chatMessage: true,
      },
    }],
  } as const,
  misskeyDefaults = {
    defaultStyle: DisplayStyle.Microblog,
    features: [{
      mastodonApi: false,
      misskeyApi: true,
      flags: {
        emojiReact: true,
        emojiLike: true,
        boost: true,
        quotePost: true,
        reply: true,
        follow: true,
        chatMessage: true,
      },
    }],
  } as const;

export const SOFTWARE_FEATURES: Record<string, SoftwareFeatures> = {
  tapir: {
    displayName: "Tapir",
    defaultStyle: DisplayStyle.Microblog,
    feeds: [
      {
        name: "All Personas",
        addr: { protocol: Protocol.Mastodon, path: "/api/v1/timelines/public" },
      },
    ],
    features: [{
      mastodonApi: true,
      flags: {
        follow: true,
        rawMarkdown: true,
        backfill: true,
      },
    }],
  },
  mastodon: {
    displayName: "Mastodon",
    defaultStyle: DisplayStyle.Microblog,
    feeds: mastodonFeeds,
    features: [{
      mastodonApi: true,
      flags: {
        like: true,
        boost: true,
        reply: true,
        follow: true,
        rawMarkdown: true,
      },
    }, {
      versionSuffix: "+glitch",
      flags: {
        quotePost: true,
      },
    }],
  },
  pleroma: {
    displayName: "Pleroma",
    ...pleromaDefaults,
  },
  akkoma: {
    displayName: "Akkoma",
    ...pleromaDefaults,
  },
  misskey: {
    displayName: "Misskey",
    ...misskeyDefaults,
  },
  foundkey: {
    displayName: "Foundkey",
    ...misskeyDefaults,
  },
  calckey: {
    displayName: "Calckey",
    ...misskeyDefaults,
    feeds: mastodonFeeds,
    features: [{
      mastodonApi: true,
      flags: {
        emojiReact: true,
        emojiLike: true,
        boost: true,
        quotePost: true,
        reply: true,
        follow: true,
        chatMessage: true,
      },
    }],
  },
  pixelfed: {
    displayName: "Pixelfed",
    defaultStyle: DisplayStyle.Gallery,
    feeds: mastodonFeeds,
    features: [{
      mastodonApi: true,
      flags: {
        like: true,
        boost: true,
        reply: true,
        follow: true,
      },
    }],
  },
  lemmy: {
    displayName: "Lemmy",
    defaultStyle: DisplayStyle.Linkboard,
    features: [{
      mastodonApi: false,
      flags: {
        upDownVote: true,
        boost: true,
        reply: true,
        follow: true,
      },
    }],
  },
  writefreely: {
    displayName: "WriteFreely",
    defaultStyle: DisplayStyle.Blog,
    features: [{
      mastodonApi: false,
      flags: {
        like: true,
        boost: true,
        reply: true,
        follow: true,
      },
    }],
  },
  peertube: {
    displayName: "PeerTube",
    defaultStyle: DisplayStyle.Channel,
    features: [{
      mastodonApi: false,
      flags: {
        like: true,
        dislike: true,
        boost: true,
        reply: true,
        follow: true,
      },
    }],
  },
  wordpress: {
    displayName: "WordPress",
    defaultStyle: DisplayStyle.Blog,
    features: [{
      mastodonApi: false,
      flags: {
        like: true,
        boost: true,
        reply: true,
        follow: true,
      },
    }],
  },
  hubzilla: {
    displayName: "Hubzilla",
    defaultStyle: DisplayStyle.Tumblelog,
    features: [{
      mastodonApi: false,
      flags: {
        like: true,
        boost: true,
        reply: true,
        follow: true,
      },
    }],
  },
  friendica: {
    displayName: "Friendica",
    defaultStyle: DisplayStyle.Tumblelog,
    features: [{
      mastodonApi: false,
      flags: {
        like: true,
        boost: true,
        reply: true,
        follow: true,
      },
    }],
  },
  honk: {
    // I don't think honk actually uses nodeinfo, but it's here anyway
    displayName: "Honk",
    defaultStyle: DisplayStyle.Microblog,
    features: [{
      mastodonApi: false,
      flags: {
        like: true,
        boost: true,
        reply: true,
        follow: true,
        chatMessage: true,
      },
    }],
  },
  gotosocial: {
    displayName: "GoToSocial",
    defaultStyle: DisplayStyle.Microblog,
    features: [{
      mastodonApi: false,
      flags: {
        like: true,
        boost: true,
        reply: true,
        follow: true,
      },
    }],
  },
};
