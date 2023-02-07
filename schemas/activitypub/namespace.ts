export const SCHEMA = "http://schema.org#" as const;
export const AS = "https://www.w3.org/ns/activitystreams#" as const;
export const LDP = "http://www.w3.org/ns/ldp#" as const;
export const SEC = "https://w3id.org/security#" as const;
export const TOOT = "http://joinmastodon.org/ns#" as const;

export const key = {
  attachment: `${AS}attachment`,
  attributedTo: `${AS}attributedTo`,
  audience: `${AS}audience`,
  bcc: `${AS}bcc`,
  bto: `${AS}bto`,
  cc: `${AS}cc`,
  content: `${AS}content`,
  context: `${AS}context`,
  duration: `${AS}duration`,
  endTime: `${AS}endTime`,
  generator: `${AS}generator`,
  icon: `${AS}icon`,
  image: `${AS}image`,
  inReplyTo: `${AS}inReplyTo`,
  location: `${AS}location`,
  mediaType: `${AS}mediaType`,
  name: `${AS}name`,
  preview: `${AS}preview`,
  published: `${AS}published`,
  replies: `${AS}replies`,
  summary: `${AS}summary`,
  startTime: `${AS}startTime`,
  tag: `${AS}tag`,
  to: `${AS}to`,
  updated: `${AS}updated`,
  url: `${AS}url`,

  href: `${AS}href`,
  hreflang: `${AS}hreflang`,
  rel: `${AS}rel`,
  width: `${AS}width`,
  height: `${AS}height`,
  value: `${SCHEMA}value`,

  totalItems: `${AS}totalItems`,
  current: `${AS}current`,
  first: `${AS}first`,
  last: `${AS}last`,
  next: `${AS}next`,
  prev: `${AS}prev`,
  partOf: `${AS}partOf`,
  items: `${AS}items`,

  preferredUsername: `${AS}preferredUsername`,
  inbox: `${LDP}inbox`,
  outbox: `${AS}outbox`,
  following: `${AS}following`,
  followers: `${AS}followers`,
  liked: `${AS}liked`,
  endpoints: `${AS}endpoints`,
  sharedInbox: `${AS}sharedInbox`,
  streams: `${AS}streams`,
  proxyUrl: `${AS}proxyUrl`,
  oauthAuthorizationEndpoint: `${AS}oauthAuthorizationEndpoint`,
  oauthTokenEndpoint: `${AS}oauthTokenEndpoint`,
  provideClientKey: `${AS}provideClientKey`,
  signClientKey: `${AS}signClientKey`,

  actor: `${AS}actor`,
  object: `${AS}object`,
  target: `${AS}target`,
  result: `${AS}result`,
  origin: `${AS}origin`,
  instrument: `${AS}instrument`,

  Accept: `${AS}Accept`,
  Activity: `${AS}Activity`,
  IntransitiveActivity: `${AS}IntransitiveActivity`,
  Add: `${AS}Add`,
  Announce: `${AS}Announce`,
  Application: `${AS}Application`,
  Arrive: `${AS}Arrive`,
  Article: `${AS}Article`,
  Audio: `${AS}Audio`,
  Block: `${AS}Block`,
  Collection: `${AS}Collection`,
  CollectionPage: `${AS}CollectionPage`,
  Relationship: `${AS}Relationship`,
  Create: `${AS}Create`,
  Delete: `${AS}Delete`,
  Dislike: `${AS}Dislike`,
  Document: `${AS}Document`,
  Event: `${AS}Event`,
  Follow: `${AS}Follow`,
  Flag: `${AS}Flag`,
  Group: `${AS}Group`,
  Ignore: `${AS}Ignore`,
  Image: `${AS}Image`,
  Invite: `${AS}Invite`,
  Join: `${AS}Join`,
  Leave: `${AS}Leave`,
  Like: `${AS}Like`,
  Link: `${AS}Link`,
  Mention: `${AS}Mention`,
  Note: `${AS}Note`,
  Object: `${AS}Object`,
  Offer: `${AS}Offer`,
  OrderedCollection: `${AS}OrderedCollection`,
  OrderedCollectionPage: `${AS}OrderedCollectionPage`,
  Organization: `${AS}Organization`,
  Page: `${AS}Page`,
  Person: `${AS}Person`,
  Place: `${AS}Place`,
  Profile: `${AS}Profile`,
  Question: `${AS}Question`,
  Reject: `${AS}Reject`,
  Remove: `${AS}Remove`,
  Service: `${AS}Service`,
  TentativeAccept: `${AS}TentativeAccept`,
  TentativeReject: `${AS}TentativeReject`,
  Tombstone: `${AS}Tombstone`,
  Undo: `${AS}Undo`,
  Update: `${AS}Update`,
  Video: `${AS}Video`,
  View: `${AS}View`,
  Listen: `${AS}Listen`,
  Read: `${AS}Read`,
  Move: `${AS}Move`,
  Travel: `${AS}Travel`,
  IsFollowing: `${AS}IsFollowing`,
  IsFollowedBy: `${AS}IsFollowedBy`,
  IsContact: `${AS}IsContact`,
  IsMember: `${AS}IsMember`,

  Public: `${AS}Public`,

  publicKey: `${SEC}publicKey`,
  publicKeyPem: `${SEC}publicKeyPem`,
  owner: `${SEC}owner`,

  featured: `${TOOT}featured`,
  featuredTags: `${TOOT}featuredTags`,
  discoverable: `${TOOT}discoverable`,
  devices: `${TOOT}devices`,
  manuallyApprovesFollowers: `${AS}manuallyApprovesFollowers`,
} as const;
