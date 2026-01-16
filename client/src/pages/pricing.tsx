import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/hooks/use-auth";
import { Trees, Check, ArrowLeft, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface Price {
  id: string;
  unit_amount: number;
  currency: string;
  recurring: { interval: string } | null;
}

interface Product {
  id: string;
  name: string;
  description: string;
  metadata: { tier?: string; maxTrees?: string; maxMembers?: string };
  prices: Price[];
}

export default function Pricing() {
  const [, navigate] = useLocation();
  const { user, isLoading: authLoading } = useAuth();

  const { data: productsData, isLoading: productsLoading } = useQuery<{ data: Product[] }>({
    queryKey: ["/api/products"],
  });

  const { data: subscriptionData } = useQuery<{ tier: string }>({
    queryKey: ["/api/subscription"],
    enabled: !!user,
  });

  const checkoutMutation = useMutation({
    mutationFn: async (priceId: string) => {
      const res = await apiRequest("POST", "/api/checkout", { priceId });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
  });

  const products = productsData?.data || [];
  const freePlan = products.find(p => p.metadata?.tier === "free");
  const premiumPlan = products.find(p => p.metadata?.tier === "premium");
  const currentTier = subscriptionData?.tier || "free";

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount / 100);
  };

  const handleSubscribe = (priceId: string) => {
    if (!user) {
      window.location.href = "/api/login";
      return;
    }
    checkoutMutation.mutate(priceId);
  };

  return (
    <div className="min-h-screen bg-background">
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
            Choose Your Plan
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Start for free or unlock premium features for your family tree journey.
          </p>
        </div>

        {productsLoading || authLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <Card className="relative" data-testid="card-plan-free">
              <CardHeader>
                <CardTitle className="font-serif text-2xl">Free Plan</CardTitle>
                <CardDescription>
                  Perfect for getting started with your family tree
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-4xl font-bold">
                  {freePlan?.prices?.[0] ? formatPrice(freePlan.prices[0].unit_amount) : "$0"}
                  <span className="text-lg font-normal text-muted-foreground">/month</span>
                </div>
                <ul className="space-y-3">
                  <li className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-primary" />
                    <span>1 family tree</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-primary" />
                    <span>Up to 20 family members</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-primary" />
                    <span>Basic visualization</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-primary" />
                    <span>Search functionality</span>
                  </li>
                </ul>
              </CardContent>
              <CardFooter>
                {currentTier === "free" && user ? (
                  <Badge variant="secondary" className="w-full justify-center py-2">
                    Current Plan
                  </Badge>
                ) : (
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => navigate(user ? "/dashboard" : "/")}
                    data-testid="button-start-free"
                  >
                    {user ? "Go to Dashboard" : "Get Started Free"}
                  </Button>
                )}
              </CardFooter>
            </Card>

            <Card className="relative border-primary" data-testid="card-plan-premium">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge className="bg-primary text-primary-foreground">Most Popular</Badge>
              </div>
              <CardHeader>
                <CardTitle className="font-serif text-2xl">Premium Plan</CardTitle>
                <CardDescription>
                  Unlimited features for the dedicated genealogist
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-4xl font-bold">
                  {premiumPlan?.prices?.[0] ? formatPrice(premiumPlan.prices[0].unit_amount) : "$9.99"}
                  <span className="text-lg font-normal text-muted-foreground">/month</span>
                </div>
                <ul className="space-y-3">
                  <li className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-primary" />
                    <span>Unlimited family trees</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-primary" />
                    <span>Unlimited family members</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-primary" />
                    <span>Timeline view</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-primary" />
                    <span>Collaboration features</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-primary" />
                    <span>Priority support</span>
                  </li>
                </ul>
              </CardContent>
              <CardFooter>
                {currentTier === "premium" ? (
                  <Badge variant="secondary" className="w-full justify-center py-2">
                    Current Plan
                  </Badge>
                ) : (
                  <Button 
                    className="w-full"
                    onClick={() => {
                      const priceId = premiumPlan?.prices?.[0]?.id;
                      if (priceId) handleSubscribe(priceId);
                    }}
                    disabled={checkoutMutation.isPending || !premiumPlan?.prices?.[0]?.id}
                    data-testid="button-subscribe-premium"
                  >
                    {checkoutMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Processing...
                      </>
                    ) : (
                      "Subscribe to Premium"
                    )}
                  </Button>
                )}
              </CardFooter>
            </Card>
          </div>
        )}

        <div className="text-center mt-12 text-sm text-muted-foreground">
          <p>Cancel anytime. No questions asked.</p>
        </div>
      </main>
    </div>
  );
}
