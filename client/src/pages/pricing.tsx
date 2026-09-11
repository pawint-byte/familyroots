import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ThemeToggle } from "@/components/theme-toggle";
import { SEO } from "@/components/seo";
import { useAuth } from "@/hooks/use-auth";
import { Trees, Check, ArrowLeft, Loader2, Users, Crown, Gift, TrendingUp, Package, Zap, Star, Sparkles, X, Infinity } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PRICING_CONFIG as DEFAULT_PRICING_CONFIG, type FeatureTier } from "@shared/pricing";
import { getRegisterHref } from "@/lib/register-link";

interface PricingPack {
  type: string;
  credits: number;
  priceCents: number;
  perMemberCents: number;
  label: string;
  savings?: string;
}

interface TierConfig {
  label: string;
  tagline: string;
  monthlyPriceCents: number;
  color: string;
}

interface TierLimits {
  [feature: string]: {
    explorer: number;
    cultivator: number;
    heritage: number;
    legacy: number;
  };
}

interface FeatureInfoMap {
  [feature: string]: { label: string; description: string };
}

interface PricingConfig {
  packs: PricingPack[];
  tiers: Record<string, TierConfig>;
  tierLimits: TierLimits;
  featureInfo: FeatureInfoMap;
  rewards: {
    monthlyAddsThreshold: number;
    monthlyDiscountPercent: number;
    milestoneFreePack: { memberCount: number; freeCredits: number };
  };
  freeTierCredits: number;
  unlimitedTrees: boolean;
}

interface ActiveReward {
  discountPercent: number;
  id: string;
}

interface PricingStatus {
  userId: string;
  totalMemberCount: number;
  memberCredits: number;
  isPremium: boolean;
  featureTier: string;
  monthlyAddsCount: number;
  hasActiveReward: boolean;
  activeRewardDiscount: number;
  config: PricingConfig;
  activeReward: ActiveReward | null;
  pricingModel: string;
}

const TIER_KEYS = ['explorer', 'cultivator', 'heritage', 'legacy'] as const;
const FEATURE_KEYS = ['ai_chat', 'familysearch_import', 'email_tagged_group', 'ai_avatar_video', 'media_upload', 'voice_video_upload', 'tree_wall'] as const;

const tierIcons: Record<string, typeof Crown> = {
  explorer: Users,
  cultivator: Sparkles,
  heritage: Crown,
  legacy: Star,
};

export default function Pricing() {
  const [, navigate] = useLocation();
  const { user, isLoading: authLoading } = useAuth();

  const { data: pricingStatus, isLoading: statusLoading } = useQuery<PricingStatus>({
    queryKey: ["/api/pricing/status"],
    enabled: !!user,
  });

  const { data: publicConfig } = useQuery<PricingConfig>({
    queryKey: ["/api/pricing/config"],
    enabled: !user,
  });

  const tierCheckoutMutation = useMutation({
    mutationFn: async (plan: string) => {
      const res = await apiRequest("POST", "/api/stripe/create-checkout", { plan });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
  });

  const bulkPackMutation = useMutation({
    mutationFn: async (packType: string) => {
      const res = await apiRequest("POST", "/api/pricing/bulk-pack/checkout", { packType });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
  });

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  const formatLimit = (val: number) => {
    if (val === -1) return 'Unlimited';
    if (val === 0) return '—';
    return `${val}/mo`;
  };

  const config = pricingStatus?.config || publicConfig || DEFAULT_PRICING_CONFIG;

  const currentTier = (pricingStatus?.featureTier as FeatureTier) || 'explorer';
  const memberCredits = pricingStatus?.memberCredits || 0;
  const totalMembers = pricingStatus?.totalMemberCount || 0;
  const monthlyAdds = pricingStatus?.monthlyAddsCount || 0;
  const activeReward = pricingStatus?.activeReward;
  const freeRemaining = Math.max(0, config.freeTierCredits - totalMembers);
  const registerHref = getRegisterHref();

  const handleTierCheckout = (tier: string) => {
    if (!user) {
      window.location.href = "/login";
      return;
    }
    tierCheckoutMutation.mutate(tier);
  };

  const handleBuyPack = (packType: string) => {
    if (!user) {
      window.location.href = "/login";
      return;
    }
    bulkPackMutation.mutate(packType);
  };

  const getPackIcon = (type: string) => {
    switch (type) {
      case 'starter_10': return <Package className="h-6 w-6" />;
      case 'growth_25': return <TrendingUp className="h-6 w-6" />;
      case 'family_50': return <Users className="h-6 w-6" />;
      default: return <Package className="h-6 w-6" />;
    }
  };

  return (
    <div className="pricing-page min-h-screen w-full max-w-full overflow-x-hidden bg-background">
      <SEO
        title="Pricing - FamilyRoots | Plans & Member Packs"
        description={`Start free with ${config.freeTierCredits} members. Choose a plan that fits your needs — from Explorer to Legacy. Add more members with affordable packs.`}
        keywords="family tree pricing, genealogy plans, family history subscription"
      />
      <header className="sticky top-0 z-50 backdrop-blur-md bg-background/80 border-b border-border">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-2 sm:gap-4 flex-nowrap">
          <div className="flex min-w-0 items-center gap-2 sm:gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate("/")}
              data-testid="button-back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Trees className="h-7 w-7 text-primary" />
              <span className="hidden font-serif text-xl font-semibold sm:inline">FamilyRoots</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            {user ? (
              <Button onClick={() => navigate("/dashboard")} data-testid="button-dashboard">
                Dashboard
              </Button>
            ) : (
              <Button asChild data-testid="button-login">
                <a href="/login">Log In</a>
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        {/* Hero */}
        <div className="text-center mb-6">
          <h1 className="text-4xl font-serif font-bold mb-4" data-testid="text-pricing-title">
            Plans That Grow With You
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Every plan starts with <strong>{config.freeTierCredits} free members</strong> — no credit card required.
            Upgrade anytime for more features.
          </p>
          <p className="mt-3 text-sm text-muted-foreground max-w-2xl mx-auto">
            A member is one person profile. After your free members, one member credit adds one more person
            across all of your unlimited trees.
          </p>
        </div>

        {/* 20 Free Members Banner */}
        <div className="max-w-3xl mx-auto mb-10">
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-green-500/10 via-emerald-500/10 to-teal-500/10 border border-green-500/20 p-6 text-center">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mb-2">
              <Gift className="h-7 w-7 shrink-0 text-green-500" />
              <span className="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-400 text-center">
                First {config.freeTierCredits} Members Free
              </span>
              <Gift className="h-7 w-7 shrink-0 text-green-500" />
            </div>
            <p className="text-muted-foreground">
              Create unlimited trees. Add up to {config.freeTierCredits} people across all your trees at no cost.
              After that, each credit adds one member profile. Credits are shared across your trees and do not expire.
              No credit card or trial period is required to start.
            </p>
          </div>
        </div>

        {/* Current Account Status (logged in users) */}
        {user && !statusLoading && pricingStatus && (
          <Card className="max-w-2xl mx-auto mb-10 border-primary/30" data-testid="card-current-status">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-primary/10">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="font-serif text-lg">Your Account</CardTitle>
                  <CardDescription>
                    {totalMembers} member{totalMembers !== 1 ? 's' : ''} across all trees
                  </CardDescription>
                </div>
                <div className="ml-auto">
                  <Badge 
                    style={{ backgroundColor: config.tiers[currentTier]?.color || '#6b7280', color: 'white' }}
                    data-testid="badge-current-tier"
                  >
                    {config.tiers[currentTier]?.label || 'Explorer'}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-muted/50">
                   <p className="text-xs text-muted-foreground">Member credits (1 = 1 person)</p>
                  <p className="text-xl font-bold" data-testid="text-credits-balance">
                    {freeRemaining > 0 ? `${freeRemaining} free` : memberCredits}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Added This Month</p>
                  <p className="text-xl font-bold" data-testid="text-monthly-adds">
                    {monthlyAdds}
                  </p>
                </div>
              </div>

              {activeReward && (
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 flex items-center gap-2">
                  <Zap className="h-4 w-4 text-green-500 shrink-0" />
                  <p className="text-sm">
                    <strong>{activeReward.discountPercent}% off</strong> your next member pack
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {(authLoading || statusLoading) && user && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* ==================== TIER COMPARISON ==================== */}
        <h2 className="text-2xl font-serif font-bold text-center mb-2">Choose Your Plan</h2>
        <p className="text-center text-muted-foreground mb-8 text-sm">
          All plans include {config.freeTierCredits} free members, unlimited trees, and core features.
          Paid plans unlock higher usage of advanced features. One member credit is one additional person profile.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 max-w-6xl mx-auto mb-16">
          {TIER_KEYS.map((tierKey) => {
            const tier = config.tiers[tierKey];
            if (!tier) return null;
            const isCurrent = currentTier === tierKey && user;
            const isPopular = tierKey === 'heritage';
            const TierIcon = tierIcons[tierKey] || Users;
            const tierIdx = TIER_KEYS.indexOf(tierKey);
            const currentIdx = TIER_KEYS.indexOf(currentTier as any);
            const isDowngrade = user && tierIdx < currentIdx;
            const isFree = tierKey === 'explorer';

            return (
              <Card 
                key={tierKey}
                className={`relative flex flex-col ${isPopular ? 'border-2 ring-2 ring-violet-500/20' : ''} ${isCurrent ? 'border-primary' : ''}`}
                style={isPopular ? { borderColor: tier.color } : undefined}
                data-testid={`card-tier-${tierKey}`}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                    <Badge style={{ backgroundColor: tier.color, color: 'white' }}>Most Popular</Badge>
                  </div>
                )}
                {isCurrent && (
                  <div className="absolute -top-3 right-3 z-10">
                    <Badge variant="outline" className="bg-background">Current Plan</Badge>
                  </div>
                )}

                <CardHeader className="text-center pb-2">
                  <div 
                    className="mx-auto mb-2 p-3 rounded-full"
                    style={{ backgroundColor: `${tier.color}15` }}
                  >
                    <TierIcon className="h-6 w-6" style={{ color: tier.color }} />
                  </div>
                  <CardTitle className="text-lg font-serif">{tier.label}</CardTitle>
                  <CardDescription className="text-xs">{tier.tagline}</CardDescription>
                </CardHeader>

                <CardContent className="text-center flex-1">
                  <div className="mb-4">
                    {isFree ? (
                      <div className="text-3xl font-bold">Free</div>
                    ) : (
                      <>
                        <div className="text-3xl font-bold">{formatPrice(tier.monthlyPriceCents)}</div>
                        <p className="text-xs text-muted-foreground">/month</p>
                      </>
                    )}
                  </div>

                  <div className="space-y-2 text-left">
                    <div className="flex items-center justify-between text-sm py-1 border-b border-border/50">
                      <span className="text-muted-foreground">Family trees</span>
                      <span className="font-medium">{config.unlimitedTrees ? "Unlimited" : "Included"}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm py-1 border-b border-border/50">
                      <span className="text-muted-foreground">Free member profiles</span>
                      <span className="font-medium">{config.freeTierCredits}</span>
                    </div>
                    {FEATURE_KEYS.map((featureKey) => {
                      const limits = config.tierLimits[featureKey];
                      if (!limits) return null;
                      const val = limits[tierKey as keyof typeof limits];
                      const info = config.featureInfo[featureKey];
                      if (!info) return null;

                      return (
                        <div key={featureKey} className="flex items-center justify-between text-sm py-1 border-b border-border/50 last:border-0">
                          <span className="text-muted-foreground truncate mr-2">{info.label}</span>
                          <span className={`font-medium shrink-0 ${val === 0 ? 'text-muted-foreground/50' : val === -1 ? 'text-green-500' : ''}`}>
                            {val === -1 ? (
                              <span className="flex items-center gap-1"><Infinity className="h-3.5 w-3.5" /></span>
                            ) : val === 0 ? (
                              <X className="h-3.5 w-3.5" />
                            ) : (
                              `${val}/mo`
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>

                <CardFooter className="pt-0">
                  {isCurrent ? (
                    <Badge variant="secondary" className="w-full justify-center py-2" data-testid={`badge-tier-active-${tierKey}`}>
                      <Check className="h-3 w-3 mr-1" />
                      Active
                    </Badge>
                  ) : isFree ? (
                    <Badge variant="outline" className="w-full justify-center py-2 text-muted-foreground">
                      Included
                    </Badge>
                  ) : isDowngrade ? (
                    <Button variant="outline" className="w-full" disabled>
                      Current plan is higher
                    </Button>
                  ) : (
                    <Button 
                      className="w-full"
                      style={isPopular ? { backgroundColor: tier.color, color: 'white' } : undefined}
                      variant={isPopular ? 'default' : 'outline'}
                      onClick={() => handleTierCheckout(tierKey)}
                      disabled={tierCheckoutMutation.isPending}
                      data-testid={`button-upgrade-${tierKey}`}
                    >
                      {tierCheckoutMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        `Upgrade to ${tier.label}`
                      )}
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>

        {/* ==================== MEMBER PACKS ==================== */}
        <div className="max-w-4xl mx-auto mb-16">
          <h2 className="text-2xl font-serif font-bold text-center mb-2">Need More Members?</h2>
          <p className="text-center text-muted-foreground mb-8 text-sm">
            After your {config.freeTierCredits} free members, add more with one-time packs. Each credit adds
            one member profile to the shared balance for all your trees; no subscription is needed for packs.
          </p>

          <div className="grid md:grid-cols-3 gap-6">
            {config.packs.map((pack, index) => {
              const isPopular = index === 1;
              const displayPrice = activeReward 
                ? Math.round(pack.priceCents * (1 - activeReward.discountPercent / 100))
                : pack.priceCents;
              
              return (
                <Card 
                  key={pack.type}
                  className={`relative ${isPopular ? 'border-primary ring-2 ring-primary/20' : ''}`}
                  data-testid={`card-pack-${pack.type}`}
                >
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-primary text-primary-foreground">Best Value</Badge>
                    </div>
                  )}
                  {pack.savings && (
                    <div className="absolute -top-3 right-3">
                      <Badge variant="secondary">Save {pack.savings}</Badge>
                    </div>
                  )}
                  <CardHeader className="text-center pb-2">
                    <div className={`mx-auto mb-2 p-3 rounded-full ${isPopular ? 'bg-primary/10 text-primary' : 'bg-muted'}`}>
                      {getPackIcon(pack.type)}
                    </div>
                    <CardTitle className="text-lg">{pack.label}</CardTitle>
                    <CardDescription>{pack.credits} credits = {pack.credits} additional member profiles</CardDescription>
                  </CardHeader>
                  <CardContent className="text-center pb-4">
                    <div className="text-3xl font-bold mb-1">
                      {activeReward && displayPrice !== pack.priceCents ? (
                        <>
                          <span className="line-through text-muted-foreground text-lg mr-2">
                            {formatPrice(pack.priceCents)}
                          </span>
                          {formatPrice(displayPrice)}
                        </>
                      ) : (
                        formatPrice(pack.priceCents)
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {formatPrice(activeReward ? Math.round(pack.perMemberCents * (1 - activeReward.discountPercent / 100)) : pack.perMemberCents)} per member
                    </p>
                  </CardContent>
                  <CardFooter>
                    <Button 
                      className="w-full"
                      variant={isPopular ? 'default' : 'outline'}
                      onClick={() => handleBuyPack(pack.type)}
                      disabled={bulkPackMutation.isPending}
                      data-testid={`button-buy-${pack.type}`}
                    >
                      {bulkPackMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        `Buy ${pack.label}`
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        </div>

        {/* ==================== REWARDS ==================== */}
        <div className="max-w-2xl mx-auto mb-16">
          <h2 className="text-2xl font-serif font-bold text-center mb-8">Earn Rewards</h2>
          <div className="grid sm:grid-cols-2 gap-6">
            <Card data-testid="card-reward-monthly">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-yellow-500/10">
                    <Zap className="h-5 w-5 text-yellow-500" />
                  </div>
                  <CardTitle className="text-base">Monthly Activity Bonus</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Add {config.rewards.monthlyAddsThreshold}+ members in a month and get <strong>{config.rewards.monthlyDiscountPercent}% off</strong> your next member pack purchase.
                </p>
              </CardContent>
            </Card>
            <Card data-testid="card-reward-milestone">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-green-500/10">
                    <Star className="h-5 w-5 text-green-500" />
                  </div>
                  <CardTitle className="text-base">100 Member Milestone</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Connect {config.rewards.milestoneFreePack.memberCount} members and earn a <strong>free {config.rewards.milestoneFreePack.freeCredits}-member pack</strong> as a thank you.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* CTA for non-logged-in */}
        {!user && (
          <div className="text-center mt-12">
            <p className="text-muted-foreground mb-4">Sign in to start building your family tree — {config.freeTierCredits} members free.</p>
            <Button asChild size="lg" data-testid="button-get-started">
              <a href={registerHref}>Get Started Free</a>
            </Button>
          </div>
        )}

        <div className="text-center mt-12 text-sm text-muted-foreground">
          <p>Member packs never expire. Subscriptions can be cancelled anytime. All plans include {config.freeTierCredits} free members.</p>
        </div>
      </main>
    </div>
  );
}
