import { MatchesSchema } from "https://deno.land/x/spartanschema@v1.0.1/mod.ts";
import { commonDefs, ObjectCommon } from "$/schemas/activitypub/Object.ts";

export const schema = {
  schema: {
    ...ObjectCommon,

    id: "string",
    type: [
      "enum",
      "Accept",
      "Add",
      "Announce",
      "Arrive",
      "Block",
      "Create",
      "Delete",
      "Dislike",
      "Flag",
      "Follow",
      "Ignore",
      "Invite",
      "Join",
      "Leave",
      "Like",
      "Listen",
      "Move",
      "Offer",
      "Question",
      "Reject",
      "Read",
      "Remove",
      "TentativeReject",
      "TentativeAccept",
      "Travel",
      "Undo",
      "Update",
      "View",
    ],

    actor: ["ref", "ObjectOrLinkRef"],
    object: ["optional", ["ref", "ObjectOrLinkRefs"]],
    target: ["optional", ["ref", "ObjectOrLinkRefs"]],
    result: ["optional", ["ref", "ObjectOrLinkRefs"]],
    origin: ["optional", ["ref", "ObjectOrLinkRef"]],
    instrument: ["optional", ["ref", "ObjectOrLinkRefs"]],
  },
  let: commonDefs,
} as const;

export type Activity = MatchesSchema<typeof schema>;
