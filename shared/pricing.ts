export type FeatureTier = "explorer" | "cultivator" | "heritage" | "legacy";

export type PremiumFeature =
  | "ai_chat"
  | "familysearch_import"
  | "email_tagged_group"
  | "ai_avatar_video"
  | "media_upload"
  | "voice_video_upload"
  | "tree_wall";

export const TIER_ORDER: FeatureTier[] = ["explorer", "cultivator", "heritage", "legacy"];

export const TIER_CONFIG: Record<
  FeatureTier,
  { label: string; tagline: string; monthlyPriceCents: number; color: string }
> = {
  explorer: {
    label: "Explorer",
    tagline: "Try it out, no commitment",
    monthlyPriceCents: 0,
    color: "#6b7280",
  },
  cultivator: {
    label: "Cultivator",
    tagline: "For regular users building their trees",
    monthlyPriceCents: 499,
    color: "#3b82f6",
  },
  heritage: {
    label: "Heritage",
    tagline: "For power users and large groups",
    monthlyPriceCents: 1299,
    color: "#8b5cf6",
  },
  legacy: {
    label: "Legacy",
    tagline: "For families who want the most features while supporting FamilyRoots",
    monthlyPriceCents: 2499,
    color: "#f59e0b",
  },
};

export const TIER_LIMITS: Record<PremiumFeature, Record<FeatureTier, number>> = {
  ai_chat: { explorer: 5, cultivator: 30, heritage: 100, legacy: 300 },
  familysearch_import: { explorer: 1, cultivator: 5, heritage: 15, legacy: 40 },
  email_tagged_group: { explorer: 2, cultivator: 10, heritage: 30, legacy: -1 },
  ai_avatar_video: { explorer: 0, cultivator: 2, heritage: 5, legacy: 10 },
  media_upload: { explorer: 10, cultivator: 50, heritage: 200, legacy: 500 },
  voice_video_upload: { explorer: 0, cultivator: 20, heritage: 80, legacy: 200 },
  tree_wall: { explorer: 0, cultivator: -1, heritage: -1, legacy: -1 },
};

export const FEATURE_INFO: Record<PremiumFeature, { label: string; description: string }> = {
  ai_chat: { label: "AI Chat", description: "AI-powered family tree assistant" },
  familysearch_import: { label: "FamilySearch Import", description: "Import ancestors from FamilySearch" },
  email_tagged_group: { label: "Email Tagged Group", description: "Send emails to tagged members" },
  ai_avatar_video: { label: "AI Avatar Video", description: "Generate AI avatar videos" },
  media_upload: { label: "Media Upload", description: "Upload photos and media to events" },
  voice_video_upload: { label: "Voice & Video", description: "Record voice notes and attach videos to members" },
  tree_wall: { label: "Group Wall", description: "Group messaging wall within your trees" },
};

export const PRICING_CONFIG = {
  packs: [
    { type: "starter_10" as const, credits: 10, priceCents: 799, perMemberCents: 80, label: "Starter Pack", savings: undefined },
    { type: "growth_25" as const, credits: 25, priceCents: 1499, perMemberCents: 60, label: "Growth Pack", savings: "25%" },
    { type: "family_50" as const, credits: 50, priceCents: 2499, perMemberCents: 50, label: "Family Pack", savings: "37%" },
  ],
  tiers: TIER_CONFIG,
  tierLimits: TIER_LIMITS,
  featureInfo: FEATURE_INFO,
  rewards: {
    monthlyAddsThreshold: 5,
    monthlyDiscountPercent: 20,
    milestoneFreePack: { memberCount: 100, freeCredits: 10 },
  },
  freeTierCredits: 20,
  unlimitedTrees: true,
} as const;
