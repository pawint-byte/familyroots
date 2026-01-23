import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Shield, CheckCircle, XCircle, Clock, User, AlertCircle } from "lucide-react";
import type { CustodianshipRequest } from "@shared/schema";

export function PendingCustodianshipSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: requests = [], isLoading } = useQuery<CustodianshipRequest[]>({
    queryKey: ['/api/custodianship/pending'],
  });

  const approveMutation = useMutation({
    mutationFn: async (requestId: string) => {
      return apiRequest('POST', `/api/custodianship/${requestId}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/custodianship/pending'] });
      toast({ title: "Approved", description: "Custodianship has been granted." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to approve request", variant: "destructive" });
    },
  });

  const denyMutation = useMutation({
    mutationFn: async (requestId: string) => {
      return apiRequest('POST', `/api/custodianship/${requestId}/deny`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/custodianship/pending'] });
      toast({ title: "Denied", description: "Custodianship request has been denied." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to deny request", variant: "destructive" });
    },
  });

  const getDaysRemaining = (expiresAt: Date | string) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diffTime = expires.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Pending Custodianship Requests
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-16 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (requests.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Pending Custodianship Requests
          <Badge variant="secondary" className="ml-auto">{requests.length}</Badge>
        </CardTitle>
        <CardDescription>
          Requests from relatives to manage deceased family members' profiles
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {requests.map(request => {
          const daysRemaining = getDaysRemaining(request.expiresAt);
          
          return (
            <div 
              key={request.id}
              className="flex items-start justify-between gap-4 p-4 rounded-lg border bg-card"
              data-testid={`pending-custodianship-${request.id}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <Badge variant="outline">{request.relationshipToMember}</Badge>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {daysRemaining} days remaining
                  </span>
                </div>
                <p className="text-sm flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  {request.requesterEmail || "Unknown requester"}
                </p>
                {request.reason && (
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {request.reason}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Requested: {formatDate(request.createdAt)}
                </p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20"
                  onClick={() => approveMutation.mutate(request.id)}
                  disabled={approveMutation.isPending || denyMutation.isPending}
                  data-testid={`button-approve-custodianship-${request.id}`}
                >
                  <CheckCircle className="h-4 w-4" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                  onClick={() => denyMutation.mutate(request.id)}
                  disabled={approveMutation.isPending || denyMutation.isPending}
                  data-testid={`button-deny-custodianship-${request.id}`}
                >
                  <XCircle className="h-4 w-4" />
                  Deny
                </Button>
              </div>
            </div>
          );
        })}
        <p className="text-xs text-muted-foreground flex items-center gap-1 pt-2">
          <AlertCircle className="h-3 w-3" />
          Requests are auto-approved after 30 days if no action is taken.
        </p>
      </CardContent>
    </Card>
  );
}
