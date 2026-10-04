import { z } from "zod";
import type { EventMediaAttachment } from "@shared/schema";
import { ObjectStorageService } from "../replit_integrations/object_storage/objectStorage";

const attachmentSchema = z.object({
  url: z.string().regex(/^\/objects\/uploads\/[0-9a-f-]{36}$/i, "Invalid attachment path"),
  type: z.enum(["image", "video"]),
  caption: z.string().max(500).optional(),
  uploadedAt: z.string().datetime(),
});

export class EventMediaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EventMediaError";
  }
}

type StoredMediaMetadata = { size?: string | number; contentType?: string };

async function getStoredMediaMetadata(url: string): Promise<StoredMediaMetadata> {
  const service = new ObjectStorageService();
  const file = await service.getObjectEntityFile(url);
  const [metadata] = await file.getMetadata();
  return metadata;
}

/** Check the stored object, not just the client-declared file size/type. */
export async function validateEventMedia(
  input: unknown,
  getMetadata: (url: string) => Promise<StoredMediaMetadata> = getStoredMediaMetadata,
): Promise<EventMediaAttachment[]> {
  const parsed = z.array(attachmentSchema).safeParse(input ?? []);
  if (!parsed.success) {
    throw new EventMediaError(parsed.error.issues[0]?.message || "Invalid attachments");
  }
  for (const attachment of parsed.data) {
    let metadata;
    try {
      metadata = await getMetadata(attachment.url);
    } catch {
      throw new EventMediaError("An attachment is missing. Please upload it again.");
    }
    const size = Number(metadata.size);
    const maxBytes = (attachment.type === "video" ? 100 : 10) * 1024 * 1024;
    if (!Number.isFinite(size) || size <= 0 || size > maxBytes) {
      throw new EventMediaError(`${attachment.type === "video" ? "Videos" : "Photos"} must be non-empty and under ${maxBytes / 1024 / 1024}MB.`);
    }
    if (!metadata.contentType?.startsWith(`${attachment.type}/`)) {
      throw new EventMediaError("Attachment file type does not match its stored content.");
    }
  }
  return parsed.data;
}

export function eventMediaUsage(attachments: EventMediaAttachment[]) {
  return {
    media_upload: attachments.filter((attachment) => attachment.type === "image").length,
    voice_video_upload: attachments.filter((attachment) => attachment.type === "video").length,
  };
}