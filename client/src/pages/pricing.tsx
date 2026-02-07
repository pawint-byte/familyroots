import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ThemeToggle } from "@/components/theme-toggle";
import { SEO } from "@/components/seo";
import { useAuth } from "@/hooks/use-auth";
import { Trees, Check, ArrowLeft, Loader2, Users, Sparkles, Crown, Gift, TrendingUp, Package, Zap, Star } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface PricingPack {
  type: string;
  credits: number;
  priceCents: number;
  perMemberCents: number;
  label: string;
  savings?: string;
}

interface PricingConfig {
  packs: PricingPack[];
  premium: {
    monthlyPriceCents: number;
    label: string;
    features: string[];
  };
  rewards: {
    monthlyAddsThreshold: number;
    monthlyDiscountPercent: number;
    milestoneFreePack: { memberCount: number; freeCredits: number };
  };
  freeTierCredits: number;
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
  monthlyAddsCount: number;
  hasActiveReward: boolean;
  activeRewardDiscount: number;
  config: PricingConfig;
  activeReward: ActiveReward | null;
  pricingModel: string;
}

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

  const premiumMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/pricing/premium/checkout");
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

  const config = pricingStatus?.config || publicConfig || {
    packs: [
      { type: 'starter_10', credits: 10, priceCents: 799, perMemberCents: 80, label: 'Starter Pack' },
      { type: 'growth_25', credits: 25, priceCents: 1499, perMemberCents: 60, label: 'Growth Pack', savings: '25%' },
      { type: 'family_50', credits: 50, priceCents: 2499, perMemberCents: 50, label: 'Family Pack', savings: '37%' },
    ],
    premium: {
      monthlyPriceCents: 499,
      label: 'Premium',
      features: ['Unlimited media uploads', 'Gift registries', 'Priority support', 'Advanced analytics'],
    },
    rewards: {
      monthlyAddsThreshold: 5,
      monthlyDiscountPercent: 20,
      milestoneFreePack: { memberCount: 100, freeCredits: 10 },
    },
    freeTierCredits: 20,
  };

  const memberCredits = pricingStatus?.memberCredits || 0;
  const totalMembers = pricingStatus?.totalMemberCount || 0;
  const monthlyAdds = pricingStatus?.monthlyAddsCount || 0;
  const isPremium = pricingStatus?.isPremium || false;
  const activeReward = pricingStatus?.activeReward;
  const freeRemaining = Math.max(0, config.freeTierCredits - totalMembers);

  const getPackIcon = (type: string) => {
    switch (type) {
      case 'starter_10': return <Package className="h-6 w-6" />;
      case 'growth_25': return <TrendingUp className="h-6 w-6" />;
      case 'family_50': return <Users className="h-6 w-6" />;
      default: return <Package className="h-6 w-6" />;
    }
  };

  const handleBuyPack = (packType: string) => {
    if (!user) {
      window.location.href = "/api/login";
      return;
    }
    bulkPackMutation.mutate(packType);
  };

  const handleBuyPremium = () => {
    if (!user) {
      window.location.href = "/api/login";
      return;
    }
    premiumMutation.mutate();
  };

  const pricingStructuredData = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "FamilyRoots Member Packs",
    "description": "Add family members to your tree with flexible member packs. First 20 members free.",
    "offers": config.packs.map(pack => ({
      "@type": "Offer",
      "name": pack.label,
      "price": (pack.priceCents / 100).toFixed(2),
      "priceCurrency": "USD",
      "description": `${pack.credits} member credits at ${formatPrice(pack.perMemberCents)} each`
    }))
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Pricing - FamilyRoots | Family Tree Member Packs"
        description="Build your family tree for free. First 20 members included. Add more with affordable member packs starting at $7.99."
        keywords="family tree pricing, genealogy member packs, family history"
        structuredData={pricingStructuredData}
      />
      <header className="sticky top-0 z-50 backdrop-blur-md bg-background/80 border-b border-border">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
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
              <span className="font-serif text-xl font-semibold">FamilyRoots</span>
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
                <a href="/api/login">Log In</a>
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-serif font-bold mb-4" data-testid="text-pricing-title">
            Simple, Fair Pricing
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Start for free with {config.freeTierCredits} family members. Add more anytime with affordable member packs. 
            The more active you are, the more you save.
          </p>
        </div>

        {user && !statusLoading && pricingStatus && (
          <Card className="max-w-2xl mx-auto mb-12 border-primary" data-testid="card-current-status">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-primary/10">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="font-serif">Your Account</CardTitle>
                  <CardDescription>
                    {totalMembers} family members across all trees
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Member Credits</p>
                  <p className="text-2xl font-bold" data-testid="text-credits-balance">
                    {freeRemaining > 0 ? `${freeRemaining} free` : memberCredits}
                  </p>
                  {freeRemaining > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {freeRemaining} of {config.freeTierCredits} free slots remaining
                    </p>
                  )}
                  {freeRemaining <= 0 && memberCredits > 0 && (
                    <p className="text-xs text-muted-foreground">purchased credits available</p>
                  )}
                  {freeRemaining <= 0 && memberCredits <= 0 && (
                    <p className="text-xs text-muted-foreground">purchase a pack to add more</p>
                  )}
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">This Month</p>
                  <p className="text-2xl font-bold" data-testid="text-monthly-adds">
                    {monthlyAdds} added
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {monthlyAdds >= config.rewards.monthlyAddsThreshold 
                      ? "Reward earned!" 
                      : `${config.rewards.monthlyAddsThreshold - monthlyAdds} more for ${config.rewards.monthlyDiscountPercent}% off`}
                  </p>
                </div>
              </div>

              {activeReward && (
                <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30 flex items-center gap-3">
                  <Zap className="h-5 w-5 text-green-500 shrink-0" />
                  <div>
                    <p className="font-medium text-sm">Active Reward: {activeReward.discountPercent}% Off</p>
                    <p className="text-xs text-muted-foreground">
                      Automatically applied to your next member pack purchase
                    </p>
                  </div>
                </div>
              )}

              {!isPremium && (
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="text-xs">Free Plan</Badge>
                  <span className="text-sm text-muted-foreground">
                    Upgrade to Premium for unlimited media and more
                  </span>
                </div>
              )}

              {isPremium && (
                <div className="flex items-center gap-3">
                  <Badge className="bg-gradient-to-r from-violet-500 to-purple-500 text-white border-0">
                    <Crown className="h-3 w-3 mr-1" />
                    Premium
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    All premium features unlocked
                  </span>
                </div>
              )}

              {totalMembers > 0 && totalMembers < config.rewards.milestoneFreePack.memberCount && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progress to free {config.rewards.milestoneFreePack.freeCredits}-pack bonus</span>
                    <span>{totalMembers} / {config.rewards.milestoneFreePack.memberCount} members</span>
                  </div>
                  <Progress 
                    value={(totalMembers / config.rewards.milestoneFreePack.memberCount) * 100} 
                    className="h-3" 
                  />
                  <p className="text-xs text-muted-foreground">
                    Connect {config.rewards.milestoneFreePack.memberCount - totalMembers} more members to earn a free {config.rewards.milestoneFreePack.freeCredits}-member pack
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {(authLoading || statusLoading) && user && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Free Tier Highlight */}
        <div className="text-center mb-8">
          <Badge variant="secondary" className="text-base px-4 py-1.5 mb-4">
            <Gift className="h-4 w-4 mr-2" />
            First {config.freeTierCredits} members are free
          </Badge>
          <p className="text-sm text-muted-foreground">Unlimited trees. No credit card required to get started.</p>
        </div>

        <h2 className="text-2xl font-serif font-bold text-center mb-8">Member Packs</h2>
        
        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-16">
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
                    <Badge className="bg-primary text-primary-foreground">Most Popular</Badge>
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
                  <CardDescription>
                    {pack.credits} member credits
                  </CardDescription>
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

        {/* Premium Section */}
        <div className="max-w-2xl mx-auto mb-16">
          <h2 className="text-2xl font-serif font-bold text-center mb-8">Premium Features</h2>
          <Card className="border-violet-500/30" data-testid="card-premium">
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-gradient-to-r from-violet-500/10 to-purple-500/10">
                    <Crown className="h-6 w-6 text-violet-500" />
                  </div>
                  <div>
                    <CardTitle className="font-serif">FamilyRoots Premium</CardTitle>
                    <CardDescription>Unlock all advanced features</CardDescription>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">{formatPrice(config.premium.monthlyPriceCents)}</p>
                  <p className="text-sm text-muted-foreground">/month</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {config.premium.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-500 shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              {isPremium ? (
                <Badge variant="secondary" className="w-full justify-center py-2" data-testid="badge-premium-active">
                  <Crown className="h-3 w-3 mr-1" />
                  Active
                </Badge>
              ) : (
                <Button 
                  className="w-full bg-gradient-to-r from-violet-500 to-purple-500 text-white border-0"
                  onClick={handleBuyPremium}
                  disabled={premiumMutation.isPending}
                  data-testid="button-buy-premium"
                >
                  {premiumMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Upgrade to Premium'
                  )}
                </Button>
              )}
            </CardFooter>
          </Card>
        </div>

        {/* Rewards Section */}
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
                  Connect {config.rewards.milestoneFreePack.memberCount} family members and earn a <strong>free {config.rewards.milestoneFreePack.freeCredits}-member pack</strong> as a thank you.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {!user && (
          <div className="text-center mt-12">
            <p className="text-muted-foreground mb-4">Sign in to start building your family tree for free.</p>
            <Button asChild size="lg" data-testid="button-get-started">
              <a href="/api/login">Get Started Free</a>
            </Button>
          </div>
        )}

        <div className="text-center mt-12 text-sm text-muted-foreground">
          <p>Member packs never expire. No recurring charges unless you choose Premium. Cancel anytime.</p>
        </div>
      </main>
    </div>
  );
}
