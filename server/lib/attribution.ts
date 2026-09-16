import { db } from "../db";
import { users } from "@shared/models/auth";
import {
  getLegacyUtmFields,
  sanitizeAttributionPayload,
  type AttributionPayload,
} from "@shared/attribution";
import { eq } from "drizzle-orm";

export function parseAttribution(input: unknown): AttributionPayload | null {
  return sanitizeAttributionPayload(input);
}

export function attributionInsertFields(attribution: AttributionPayload | null) {
  return {
    attribution,
    ...getLegacyUtmFields(attribution),
  };
}

export async function persistUserAttribution(userId: string, input: unknown): Promise<void> {
  const attribution = parseAttribution(input);
  if (!attribution) return;

  const [user] = await db.select({
    attribution: users.attribution,
    utmSource: users.utmSource,
    utmMedium: users.utmMedium,
    utmCampaign: users.utmCampaign,
  }).from(users).where(eq(users.id, userId));
  if (!user || user.attribution) return;

  const legacy = getLegacyUtmFields(attribution);
  await db.update(users).set({
    attribution,
    utmSource: user.utmSource || legacy.utmSource,
    utmMedium: user.utmMedium || legacy.utmMedium,
    utmCampaign: user.utmCampaign || legacy.utmCampaign,
    updatedAt: new Date(),
  }).where(eq(users.id, userId));
}