import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Crown, Sparkles, Star, Users, ArrowUpRight } from "lucide-react";

const tierIcons: Record<string, typeof Crown> = {
  explorer: Users,
  cultivator: Sparkles,
  heritage: Crown,
  legacy: Star,
};

const tierLabels: Record<string, string> = {
  explorer: "Explorer",
  cultivator: "Cultivator",
  heritage: "Heritage",
  legacy: "Legacy",
};

const tierStyles: Record<string, { icon: string; bg: string; border: string; badge: string }> = {
  explorer: { icon: "text-gray-500", bg: "bg-gray-500/10", border: "border-gray-500/30", badge: "text-gray-600 dark:text-gray-400 border-gray-400" },
  cultivator: { icon: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/30", badge: "text-blue-600 dark:text-blue-400 border-blue-400" },
  heritage: { icon: "text-violet-500", bg: "bg-violet-500/10", border: "border-violet-500/30", badge: "text-violet-600 dark:text-violet-400 border-violet-400" },
  legacy: { icon: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/30", badge: "text-amber-600 dark:text-amber-400 border-amber-400" },
};

interface TierUpgradePromptProps {
  feature: string;
  used: number;
  limit: number;
  currentTier?: string;
  nextTier?: string | null;
  message?: string;
  compact?: boolean;
  onUpgrade?: () => void;
}

export function TierUpgradePrompt({
  feature,
  used,
  limit,
  currentTier = "explorer",
  nextTier,
  message,
  compact = false,
  onUpgrade,
}: TierUpgradePromptProps) {
  const [, navigate] = useLocation();
  const NextIcon = nextTier ? tierIcons[nextTier] || Crown : Crown;
  const nextLabel = nextTier ? tierLabels[nextTier] || "a higher plan" : "a higher plan";
  const nextStyle = nextTier ? tierStyles[nextTier] || tierStyles.heritage : tierStyles.heritage;
  const currentLabel = tierLabels[currentTier] || "Explorer";
  const progress = limit > 0 ? Math.min(100, (used / limit) * 100) : 100;

  const featureLabels: Record<string, string> = {
    ai_chat: "AI Chat messages",
    familysearch_import: "FamilySearch imports",
    email_tagged_group: "group emails",
    ai_avatar_video: "AI avatar videos",
    media_upload: "media uploads",
  };
  const featureLabel = featureLabels[feature] || feature;

  const handleUpgrade = () => {
    if (onUpgrade) {
      onUpgrade();
    } else {
      navigate("/pricing");
    }
  };

  if (compact) {
    return (
      <div className={`flex items-center gap-2 p-3 rounded-lg ${nextStyle.bg} border ${nextStyle.border} text-sm`} data-testid="tier-upgrade-compact">
        <NextIcon className={`h-4 w-4 shrink-0 ${nextStyle.icon}`} />
        <span className="flex-1">
          {message || `You've used all ${limit} ${featureLabel} this month.`}
        </span>
        <Button size="sm" variant="outline" onClick={handleUpgrade} className="shrink-0" data-testid="button-upgrade-compact">
          Upgrade
        </Button>
      </div>
    );
  }

  return (
    <Card className={`${nextStyle.border} ${nextStyle.bg}`} data-testid="tier-upgrade-prompt">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-full ${nextStyle.bg}`}>
            <NextIcon className={`h-5 w-5 ${nextStyle.icon}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">
              {message || `You've reached your ${currentLabel} limit for ${featureLabel}`}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <Progress value={progress} className="h-1.5 flex-1" />
              <span className="text-xs text-muted-foreground shrink-0">{used}/{limit}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Usage resets at the start of each month
            </p>
          </div>
        </div>
        <Button
          onClick={handleUpgrade}
          className="w-full"
          data-testid="button-upgrade-tier"
        >
          <ArrowUpRight className="h-4 w-4 mr-1" />
          Upgrade to {nextLabel}
        </Button>
      </CardContent>
    </Card>
  );
}

export function TierUsageBadge({
  used,
  limit,
  tier,
}: {
  used: number;
  limit: number;
  tier: string;
}) {
  const style = tierStyles[tier] || tierStyles.explorer;
  const label = tierLabels[tier] || "Explorer";
  const isNearLimit = limit > 0 && used >= limit * 0.8;
  const isAtLimit = limit > 0 && used >= limit;

  if (limit === -1) {
    return (
      <Badge variant="outline" className={`text-xs ${style.badge}`}>
        Unlimited ({label})
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className={`text-xs ${isAtLimit ? 'border-red-500 text-red-500 dark:text-red-400' : isNearLimit ? 'border-amber-500 text-amber-500 dark:text-amber-400' : style.badge}`}
      data-testid="badge-tier-usage"
    >
      {used}/{limit} ({label})
    </Badge>
  );
}
