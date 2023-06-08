import { Singleton } from "$/lib/inject.ts";
import {
  AttachmentNotFound,
  LocalAttachmentStore,
} from "$/models/LocalAttachment.ts";
import { LocalAttachment } from "$/models/types.ts";
import { LOCAL_ATTACHMENTS } from "./mock-data.ts";

@Singleton()
export class MockLocalAttachmentStore extends LocalAttachmentStore {
  async *list(postId?: string | undefined): AsyncIterable<LocalAttachment> {
    if (postId == null) yield* LOCAL_ATTACHMENTS;
    else yield* LOCAL_ATTACHMENTS.filter((a) => a.postId === postId);
  }

  count(postId?: string | undefined): Promise<number> {
    if (postId == null) return Promise.resolve(LOCAL_ATTACHMENTS.length);
    else {return Promise.resolve(
        LOCAL_ATTACHMENTS.filter((a) => a.postId === postId).length,
      );}
  }

  get(id: string): Promise<LocalAttachment> {
    const attachment = LOCAL_ATTACHMENTS.find((a) => a.id === id);
    if (attachment) return Promise.resolve(attachment);
    else {return Promise.reject(
        AttachmentNotFound.error(`No mock local attachment with ID ${id}`),
      );}
  }

  createDownload(): Promise<LocalAttachment> {
    throw new Error("Method not implemented.");
  }

  createImage(): Promise<LocalAttachment> {
    throw new Error("Method not implemented.");
  }

  updateAlt(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  delete(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  deleteForPost(): Promise<void> {
    throw new Error("Method not implemented.");
  }
}
