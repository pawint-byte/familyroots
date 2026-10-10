import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Crown, RotateCcw } from "lucide-react";
import { PRICING_CONFIG } from "@shared/pricing";
import { useAuth } from "@/hooks/use-auth";
import "./membership-status-bar.css";

type MembershipKind = "free" | "paid" | "admin" | "included";
type MembershipTier = "explorer" | "cultivator" | "heritage" | "legacy";

interface PricingStatus {
  membership?: {
    kind: MembershipKind;
    tier: MembershipTier;
  } | null;
  config?: {
    tiers?: Record<string, { label?: string }>;
  } | null;
}

const fallbackTierLabels: Record<MembershipTier, string> = {
  explorer: "Explorer",
  cultivator: "Cultivator",
  heritage: "Heritage",
  legacy: "Legacy",
};

export function MembershipStatusBar() {
  const { user } = useAuth();
  const {
    data: status,
    isLoading,
    isError,
    refetch,
  } = useQuery<PricingStatus>({
    queryKey: ["/api/pricing/status"],
    enabled: !!user,
    staleTime: 15_000,
    refetchInterval: 20_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

  if (!user) return null;

  const membership = status?.membership;
  const tier = membership?.tier;
  const configuredLabel = tier ? status?.config?.tiers?.[tier]?.label : undefined;
  const pricingTierLabel = tier
    ? (PRICING_CONFIG.tiers as Record<string, { label?: string }>)[tier]?.label
    : undefined;
  const tierLabel =
    (configuredLabel && configuredLabel.trim()) ||
    pricingTierLabel ||
    (tier ? fallbackTierLabels[tier] : undefined);

  let label = "Checking membership…";
  if (isError) {
    label = "Membership unavailable";
  } else if (!isLoading && membership) {
    switch (membership.kind) {
      case "free":
        label = "Free · Explorer";
        break;
      case "paid":
        label = `Paid · ${tierLabel ?? fallbackTierLabels[membership.tier]}`;
        break;
      case "admin":
        label = "Admin · Legacy access";
        break;
      case "included":
        label = `Included · ${tierLabel ?? fallbackTierLabels[membership.tier]}`;
        break;
    }
  }

  return (
    <div
      id="membership-status-bar"
      className="membership-status-bar"
      role="region"
      aria-label={`Membership status: ${label}`}
    >
      <a
        id="link-membership-account"
        className="membership-status-link"
        href="/account/settings"
        aria-label={`Membership status: ${label}. Open account settings.`}
      >
        <span className="membership-status-mark" aria-hidden="true">
          <Crown size={16} strokeWidth={1.8} />
        </span>
        <span id="text-membership-status" aria-live="polite">
          {label}
        </span>
      </a>

      {isError ? (
        <button
          className="membership-retry"
          type="button"
          onClick={() => void refetch()}
          aria-label="Retry loading membership status"
        >
          <RotateCcw size={14} aria-hidden="true" />
          <span>Retry</span>
        </button>
      ) : null}

      <a
        id="link-membership-upgrade"
        className="membership-upgrade-link"
        href="/pricing#paid-plans"
      >
        <span>{membership?.kind === "free" ? "Upgrade" : "Plans / Upgrade"}</span>
        <ArrowUpRight size={15} strokeWidth={2} aria-hidden="true" />
      </a>
    </div>
  );
}
