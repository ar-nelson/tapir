import { MatchesSchema } from "https://deno.land/x/spartanschema@v1.0.1/mod.ts";
import { commonDefs, ObjectCommon } from "$/schemas/activitypub/Object.ts";
import { key } from "$/schemas/activitypub/namespace.ts";

export const schema = {
  schema: {
    "@id": "string",
    "@type": [
      "enum",
      key.Accept,
      key.Add,
      key.Announce,
      key.Arrive,
      key.Block,
      key.Create,
      key.Delete,
      key.Dislike,
      key.Flag,
      key.Follow,
      key.Ignore,
      key.Invite,
      key.Join,
      key.Leave,
      key.Like,
      key.Listen,
      key.Move,
      key.Offer,
      key.Question,
      key.Reject,
      key.Read,
      key.Remove,
      key.TentativeReject,
      key.TentativeAccept,
      key.Travel,
      key.Undo,
      key.Update,
      key.View,
    ],

    ...ObjectCommon,

    [key.actor]: ["ref", "ObjectOrLinkRef"],
    [key.object]: ["optional", ["ref", "ObjectOrLinkRefs"]],
    [key.target]: ["optional", ["ref", "ObjectOrLinkRefs"]],
    [key.result]: ["optional", ["ref", "ObjectOrLinkRefs"]],
    [key.origin]: ["optional", ["ref", "ObjectOrLinkRef"]],
    [key.instrument]: ["optional", ["ref", "ObjectOrLinkRefs"]],
  },
  let: commonDefs,
} as const;

export type Activity = MatchesSchema<typeof schema>;
