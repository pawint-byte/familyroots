import { useMutation, useQuery } from "@tanstack/react-query";
import { CreditCard, Loader2, RotateCcw } from "lucide-react";
import { PRICING_CONFIG } from "@shared/pricing";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type FeatureTier = keyof typeof PRICING_CONFIG.tiers;

interface PricingStatus {
  featureTier?: string;
  config?: {
    tiers?: Record<string, { label?: string }>;
  } | null;
}

export function SubscriptionBillingCard() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const {
    data: pricingStatus,
    isLoading: pricingLoading,
    isError: pricingError,
    refetch,
  } = useQuery<PricingStatus>({
    queryKey: ["/api/pricing/status"],
    enabled: !!user,
  });

  const portalMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/customer-portal");
      const result: unknown = await response.json();
      const url =
        typeof result === "object" && result !== null && "url" in result
          ? result.url
          : null;
      if (typeof url !== "string" || !url.trim()) {
        throw new Error("The billing portal did not return a destination. Please try again.");
      }
      return url;
    },
    onSuccess: (url) => {
      window.location.href = url;
    },
    onError: (error: Error) => {
      toast({
        title: "Unable to open billing",
        description: error.message || "Please try again in a moment.",
        variant: "destructive",
      });
    },
  });

  const tierKey = pricingStatus?.featureTier;
  const tierIsKnown = !!tierKey && tierKey in PRICING_CONFIG.tiers;
  const tierLabel = tierIsKnown
    ? pricingStatus?.config?.tiers?.[tierKey]?.label ??
      PRICING_CONFIG.tiers[tierKey as FeatureTier].label
    : null;

  return (
    <Card data-testid="card-subscription-billing">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Subscription &amp; Billing
        </CardTitle>
        <CardDescription>
          Review your current plan, compare paid options, or manage billing securely.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border bg-muted/30 p-4">
          <p className="text-sm font-medium">Current plan</p>
          {authLoading || pricingLoading ? (
            <Skeleton className="mt-2 h-5 w-36" aria-label="Loading current plan" />
          ) : pricingError ? (
            <p className="mt-1 text-sm text-muted-foreground" role="status">
              We couldn’t load your plan details. Please try again.
            </p>
          ) : tierLabel ? (
            <p className="mt-1 text-sm text-muted-foreground">{tierLabel}</p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              Your plan details aren’t available right now.
            </p>
          )}
        </div>

        <p className="text-sm text-muted-foreground">
          Choose a monthly plan to find the right fit for your family. Checkout is
          handled securely.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button asChild className="w-full sm:w-auto">
            <a href="/pricing#paid-plans" data-testid="link-subscription-plans">
              Choose a paid plan
            </a>
          </Button>

          {user?.stripeCustomerId ? (
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              data-testid="button-manage-billing"
              disabled={portalMutation.isPending}
              onClick={() => portalMutation.mutate()}
            >
              {portalMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {portalMutation.isPending ? "Opening billing…" : "Manage billing"}
            </Button>
          ) : null}
        </div>

        {pricingError ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="px-0"
            onClick={() => void refetch()}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Try again
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
