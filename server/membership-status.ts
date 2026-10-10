import { isAdminAccount } from "./adminConfig";
import { TIER_ORDER, type FeatureTier } from "@shared/pricing";

export interface MembershipStatus {
  kind: "free" | "paid" | "admin" | "included";
  tier: FeatureTier;
}

export function getMembershipStatus(user: {
  id?: string | null;
  email?: string | null;
  isAdmin?: boolean | null;
  isPremium?: boolean | null;
  premiumTier?: string | null;
  stripeSubscriptionId?: string | null;
  isSubscriptionActive?: boolean | null;
}): MembershipStatus {
  const tier: FeatureTier =
    user.premiumTier && TIER_ORDER.includes(user.premiumTier as FeatureTier) && user.premiumTier !== "explorer"
      ? user.premiumTier as FeatureTier
      : user.isPremium ? "cultivator" : "explorer";
  // Purchased membership is distinct from additional admin or included access.
  if (user.isPremium && user.isSubscriptionActive && user.stripeSubscriptionId) {
    return { kind: "paid", tier };
  }
  if (user.isAdmin || isAdminAccount(user.id, user.email)) {
    return { kind: "admin", tier: "legacy" };
  }
  if (tier !== "explorer") return { kind: "included", tier };
  return { kind: "free", tier: "explorer" };
}
