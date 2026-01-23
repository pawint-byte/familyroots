import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ThemeToggle } from "@/components/theme-toggle";
import { SEO } from "@/components/seo";
import { useAuth } from "@/hooks/use-auth";
import { Trees, Check, ArrowLeft, Loader2, Users, Sparkles, Crown, Gift, TrendingUp } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface SubscriptionInfo {
  userId: string;
  totalMemberCount: number;
  currentTier: string;
  discountPercent: number;
  monthlyPrice: number;
  nextTier: { name: string; membersNeeded: number; discountPercent: number; progressPercent: number } | null;
  isSubscriptionActive: boolean;
  lastMilestoneReached: number;
  nextMilestone: number | null;
  milestonePaymentRequired: boolean;
  config: {
    basePriceMonthly: number;
    tiers: Array<{
      name: string;
      minMembers: number;
      maxMembers: number;
      discountPercent: number;
      monthlyPrice: number;
    }>;
    milestonePaymentCents: number;
  };
}

export default function Pricing() {
  const [, navigate] = useLocation();
  const { user, isLoading: authLoading } = useAuth();

  const { data: subscriptionData, isLoading: subscriptionLoading } = useQuery<SubscriptionInfo>({
    queryKey: ["/api/subscription"],
    enabled: !!user,
  });

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/subscription/checkout", {});
      return res.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
  });

  const milestoneMutation = useMutation({
    mutationFn: async (milestone: number) => {
      const res = await apiRequest("POST", "/api/subscription/milestone-payment", { milestone });
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

  const getTierDisplayName = (tier: string) => {
    const names: Record<string, string> = {
      'free': 'Starter',
      'tier_25': 'Growing Family',
      'tier_50': 'Extended Family',
      'tier_75': 'Family Reunion',
      'tier_100': 'Heritage',
    };
    return names[tier] || tier;
  };

  const getTierIcon = (tier: string) => {
    const icons: Record<string, JSX.Element> = {
      'free': <Users className="h-6 w-6" />,
      'tier_25': <TrendingUp className="h-6 w-6" />,
      'tier_50': <Sparkles className="h-6 w-6" />,
      'tier_75': <Gift className="h-6 w-6" />,
      'tier_100': <Crown className="h-6 w-6" />,
    };
    return icons[tier] || <Users className="h-6 w-6" />;
  };

  const config = subscriptionData?.config || {
    basePriceMonthly: 999,
    tiers: [
      { name: 'free', minMembers: 0, maxMembers: 24, discountPercent: 0, monthlyPrice: 999 },
      { name: 'tier_25', minMembers: 25, maxMembers: 49, discountPercent: 25, monthlyPrice: 749 },
      { name: 'tier_50', minMembers: 50, maxMembers: 74, discountPercent: 50, monthlyPrice: 499 },
      { name: 'tier_75', minMembers: 75, maxMembers: 99, discountPercent: 75, monthlyPrice: 250 },
      { name: 'tier_100', minMembers: 100, maxMembers: Infinity, discountPercent: 100, monthlyPrice: 0 },
    ],
    milestonePaymentCents: 299,
  };

  const pricingStructuredData = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "FamilyRoots Subscription",
    "description": "Family tree subscription with tiered discounts based on family size",
    "offers": config.tiers.map(tier => ({
      "@type": "Offer",
      "name": getTierDisplayName(tier.name),
      "price": (tier.monthlyPrice / 100).toFixed(2),
      "priceCurrency": "USD",
      "description": `${tier.minMembers}+ family members - ${tier.discountPercent}% discount`
    }))
  };

  const currentTier = subscriptionData?.currentTier || 'free';
  const memberCount = subscriptionData?.totalMemberCount || 0;
  const nextTier = subscriptionData?.nextTier;
  const progressToNext = nextTier?.progressPercent ?? 100;

  const handleSubscribe = () => {
    if (!user) {
      window.location.href = "/api/login";
      return;
    }
    checkoutMutation.mutate();
  };

  const handleMilestonePayment = () => {
    if (subscriptionData?.nextMilestone) {
      milestoneMutation.mutate(subscriptionData.nextMilestone);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Pricing - FamilyRoots | Family Tree Subscription"
        description="Build your family tree and unlock discounts! Get up to 100% off your subscription by adding family members. Start at $9.99/month."
        keywords="family tree pricing, genealogy subscription, family history discount"
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
            Grow Your Tree, Shrink Your Bill
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            The more family members you add, the bigger your discount. Reach 100 members and enjoy your subscription for free!
          </p>
        </div>

        {user && !subscriptionLoading && subscriptionData && (
          <Card className="max-w-2xl mx-auto mb-12 border-primary" data-testid="card-current-status">
            <CardHeader>
              <div className="flex items-center gap-3">
                {getTierIcon(currentTier)}
                <div>
                  <CardTitle className="font-serif">Your Current Tier: {getTierDisplayName(currentTier)}</CardTitle>
                  <CardDescription>
                    {subscriptionData.discountPercent}% discount with {memberCount} family members
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between text-2xl font-bold">
                <span>Current Price:</span>
                <span className="text-primary">
                  {subscriptionData.monthlyPrice === 0 ? (
                    <span className="flex items-center gap-2">
                      <Crown className="h-6 w-6 text-yellow-500" />
                      FREE
                    </span>
                  ) : (
                    formatPrice(subscriptionData.monthlyPrice) + "/month"
                  )}
                </span>
              </div>

              {nextTier && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progress to {getTierDisplayName(nextTier.name)}</span>
                    <span>{memberCount} / {nextTier.membersNeeded} members</span>
                  </div>
                  <Progress value={progressToNext} className="h-3" />
                  <p className="text-sm text-muted-foreground">
                    Add {nextTier.membersNeeded - memberCount} more members to unlock {nextTier.discountPercent}% off!
                  </p>
                </div>
              )}

              {subscriptionData.milestonePaymentRequired && subscriptionData.nextMilestone && (
                <div className="p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
                  <p className="font-medium mb-2">Milestone Payment Required</p>
                  <p className="text-sm text-muted-foreground mb-3">
                    You've reached {subscriptionData.nextMilestone} members! 
                    A one-time payment of {formatPrice(config.milestonePaymentCents)} unlocks this milestone.
                  </p>
                  <Button 
                    onClick={handleMilestonePayment}
                    disabled={milestoneMutation.isPending}
                    data-testid="button-pay-milestone"
                  >
                    {milestoneMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Processing...
                      </>
                    ) : (
                      `Pay ${formatPrice(config.milestonePaymentCents)} to Unlock`
                    )}
                  </Button>
                </div>
              )}

              {!subscriptionData.isSubscriptionActive && subscriptionData.monthlyPrice > 0 && (
                <Button 
                  className="w-full"
                  onClick={handleSubscribe}
                  disabled={checkoutMutation.isPending}
                  data-testid="button-subscribe"
                >
                  {checkoutMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Processing...
                    </>
                  ) : (
                    `Subscribe for ${formatPrice(subscriptionData.monthlyPrice)}/month`
                  )}
                </Button>
              )}

              {subscriptionData.isSubscriptionActive && (
                <Badge variant="secondary" className="w-full justify-center py-2" data-testid="badge-active-subscription">
                  Active Subscription
                </Badge>
              )}
            </CardContent>
          </Card>
        )}

        {(authLoading || subscriptionLoading) && user && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        <h2 className="text-2xl font-serif font-bold text-center mb-8">Discount Tiers</h2>
        
        <div className="grid md:grid-cols-5 gap-4 max-w-6xl mx-auto">
          {config.tiers.map((tier, index) => {
            const isCurrentTier = currentTier === tier.name;
            const isPastTier = user && config.tiers.findIndex(t => t.name === currentTier) > index;
            
            return (
              <Card 
                key={tier.name}
                className={`relative ${isCurrentTier ? 'border-primary ring-2 ring-primary/20' : ''}`}
                data-testid={`card-tier-${tier.name}`}
              >
                {isCurrentTier && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground">Your Tier</Badge>
                  </div>
                )}
                <CardHeader className="text-center pb-2">
                  <div className={`mx-auto mb-2 p-3 rounded-full ${isCurrentTier ? 'bg-primary/10 text-primary' : isPastTier ? 'bg-green-500/10 text-green-500' : 'bg-muted'}`}>
                    {getTierIcon(tier.name)}
                  </div>
                  <CardTitle className="text-lg">{getTierDisplayName(tier.name)}</CardTitle>
                  <CardDescription className="text-xs">
                    {tier.minMembers === 100 ? '100+' : `${tier.minMembers}-${tier.maxMembers}`} members
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-center pb-2">
                  <div className="text-2xl font-bold mb-1">
                    {tier.discountPercent === 100 ? (
                      <span className="text-green-500">FREE</span>
                    ) : tier.discountPercent === 0 ? (
                      formatPrice(tier.monthlyPrice)
                    ) : (
                      <>
                        <span className="line-through text-muted-foreground text-sm mr-2">
                          {formatPrice(config.basePriceMonthly)}
                        </span>
                        {formatPrice(tier.monthlyPrice)}
                      </>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {tier.discountPercent > 0 && tier.discountPercent < 100 && `${tier.discountPercent}% off`}
                    {tier.discountPercent === 100 && 'Forever free!'}
                    {tier.discountPercent === 0 && '/month'}
                  </p>
                </CardContent>
                <CardFooter className="pt-2">
                  {isPastTier && (
                    <Badge variant="outline" className="w-full justify-center">
                      <Check className="h-3 w-3 mr-1" /> Achieved
                    </Badge>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>

        {config.tiers.find(t => t.name === 'tier_100') && (
          <div className="text-center mt-8 p-6 bg-muted/50 rounded-lg max-w-2xl mx-auto">
            <Crown className="h-8 w-8 mx-auto mb-3 text-yellow-500" />
            <h3 className="font-serif text-xl font-bold mb-2">Heritage Tier Bonus</h3>
            <p className="text-muted-foreground mb-2">
              Once you reach 100+ members, your subscription is free! 
              For every additional 25 members, a small one-time payment of {formatPrice(config.milestonePaymentCents)} is required.
            </p>
            <p className="text-sm text-muted-foreground">
              This helps us maintain quality service while rewarding your dedication to preserving your family history.
            </p>
          </div>
        )}

        {!user && (
          <div className="text-center mt-12">
            <p className="text-muted-foreground mb-4">Sign in to see your personalized pricing based on your family tree size.</p>
            <Button asChild size="lg" data-testid="button-get-started">
              <a href="/api/login">Get Started</a>
            </Button>
          </div>
        )}

        <div className="text-center mt-12 text-sm text-muted-foreground">
          <p>Cancel anytime. No questions asked. Discounts apply automatically as you add members.</p>
        </div>
      </main>
    </div>
  );
}
