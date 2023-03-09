import { view } from "$/lib/html.ts";
import { AttachmentDetail } from "$/views/types.ts";
import { AttachmentType } from "$/models/LocalAttachment.ts";

export const Attachment = view<{ attachment: AttachmentDetail }>(
  ({ attachment }) => {
    switch (attachment.type) {
      case AttachmentType.Image:
        return (
          <figure class="media media-image">
            <img src={attachment.url} alt={attachment.alt} loading="lazy" />
          </figure>
        );
      default:
        return (
          <figure class="media media-download">
            <a href={attachment.url} download>
              {attachment.alt ?? "mystery attachment"}
            </a>
          </figure>
        );
    }
  },
);
