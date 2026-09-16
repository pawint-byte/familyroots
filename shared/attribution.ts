import { z } from "zod";

export const ATTRIBUTION_VERSION = 1 as const;

const optionalLimitedString = (max: number) =>
  z.string().trim().max(max).transform(value => value || undefined).optional();

export const attributionTouchSchema = z.object({
  utm_source: optionalLimitedString(200),
  utm_medium: optionalLimitedString(200),
  utm_campaign: optionalLimitedString(200),
  utm_content: optionalLimitedString(200),
  utm_term: optionalLimitedString(200),
  referrer: optionalLimitedString(2048),
  landing_path: optionalLimitedString(2048),
  timestamp: z.string().datetime().max(40),
});

export const attributionPayloadSchema = z.object({
  version: z.literal(ATTRIBUTION_VERSION),
  firstTouch: attributionTouchSchema,
  lastTouch: attributionTouchSchema,
});

export type AttributionTouch = z.infer<typeof attributionTouchSchema>;
export type AttributionPayload = z.infer<typeof attributionPayloadSchema>;

export function sanitizeAttributionPayload(input: unknown): AttributionPayload | null {
  const result = attributionPayloadSchema.safeParse(input);
  return result.success ? result.data : null;
}

export function getLegacyUtmFields(attribution: AttributionPayload | null) {
  return {
    utmSource: attribution?.firstTouch.utm_source || attribution?.lastTouch.utm_source || null,
    utmMedium: attribution?.firstTouch.utm_medium || attribution?.lastTouch.utm_medium || null,
    utmCampaign: attribution?.firstTouch.utm_campaign || attribution?.lastTouch.utm_campaign || null,
  };
}