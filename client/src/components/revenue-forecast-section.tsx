import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, Users, TrendingUp, Crown } from "lucide-react";

interface SubscriptionMetrics {
  totalUsers: number;
  activeSubscribers: number;
  subscribersByTier: Record<string, number>;
  monthlyRecurringRevenue: number;
  projectedAnnualRevenue: number;
  freeUsers: number;
  tierBreakdown: Array<{ tier: string; count: number; monthlyRevenue: number }>;
}

export function RevenueForecastSection() {
  const { data: metrics, isLoading } = useQuery<SubscriptionMetrics>({
    queryKey: ["/api/admin/subscription-metrics"],
  });

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  if (isLoading) {
    return (
      <Card data-testid="card-revenue-forecast-loading">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!metrics) {
    return null;
  }

  return (
    <Card data-testid="card-revenue-forecast">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-serif">
          <TrendingUp className="h-5 w-5 text-primary" />
          Revenue Forecast
        </CardTitle>
        <CardDescription>
          Current subscription metrics and projected revenue based on existing customers
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg bg-muted/50" data-testid="metric-mrr">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <DollarSign className="h-4 w-4" />
              Monthly Recurring Revenue
            </div>
            <div className="text-2xl font-bold text-primary">
              {formatCurrency(metrics.monthlyRecurringRevenue)}
            </div>
          </div>

          <div className="p-4 rounded-lg bg-muted/50" data-testid="metric-arr">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" />
              Projected Annual Revenue
            </div>
            <div className="text-2xl font-bold">
              {formatCurrency(metrics.projectedAnnualRevenue)}
            </div>
          </div>

          <div className="p-4 rounded-lg bg-muted/50" data-testid="metric-subscribers">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Crown className="h-4 w-4" />
              Active Subscribers
            </div>
            <div className="text-2xl font-bold">
              {metrics.activeSubscribers}
            </div>
          </div>

          <div className="p-4 rounded-lg bg-muted/50" data-testid="metric-total-users">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Users className="h-4 w-4" />
              Total Users
            </div>
            <div className="text-2xl font-bold">
              {metrics.totalUsers}
            </div>
            <div className="text-xs text-muted-foreground">
              {metrics.freeUsers} free
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium mb-3">Tier Breakdown</h4>
          <div className="space-y-2">
            {metrics.tierBreakdown.map((tier) => (
              <div 
                key={tier.tier} 
                className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                data-testid={`tier-row-${tier.tier.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium">{tier.tier}</span>
                  <Badge variant="secondary">{tier.count} users</Badge>
                </div>
                <span className="font-medium">
                  {formatCurrency(tier.monthlyRevenue)}/mo
                </span>
              </div>
            ))}
          </div>
        </div>

        {metrics.activeSubscribers === 0 && (
          <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
            <p className="text-sm text-muted-foreground">
              No active paid subscribers yet. As users grow beyond 20 family members, 
              they'll need to subscribe to continue adding members.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
