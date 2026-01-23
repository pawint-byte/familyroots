import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { UserCheck, Clock, CheckCircle, XCircle, Trees } from "lucide-react";
import { useState } from "react";

interface PendingClaim {
  id: string;
  memberId: string;
  treeId: string;
  requesterId: string;
  requesterEmail: string | null;
  status: string;
  message: string | null;
  createdAt: string;
  memberName: string;
  treeName: string;
}

export function PendingClaimsSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [denialReasons, setDenialReasons] = useState<Record<string, string>>({});
  const [showDenyForm, setShowDenyForm] = useState<Record<string, boolean>>({});

  const { data: pendingClaims, isLoading } = useQuery<PendingClaim[]>({
    queryKey: ['/api/profile-claims/pending'],
  });

  const approveMutation = useMutation({
    mutationFn: async (claimId: string) => {
      const response = await apiRequest('POST', `/api/profile-claims/${claimId}/approve`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Claim approved",
        description: "The user can now manage their profile information.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/profile-claims/pending'] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to approve claim",
        description: error?.message || "Please try again later.",
        variant: "destructive",
      });
    },
  });

  const denyMutation = useMutation({
    mutationFn: async ({ claimId, reason }: { claimId: string; reason?: string }) => {
      const response = await apiRequest('POST', `/api/profile-claims/${claimId}/deny`, { reason });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Claim denied",
        description: "The claim request has been denied.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/profile-claims/pending'] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to deny claim",
        description: error?.message || "Please try again later.",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return null;
  }

  if (!pendingClaims || pendingClaims.length === 0) {
    return null;
  }

  return (
    <Card className="border-yellow-500/50 bg-yellow-500/5">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <UserCheck className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
          <CardTitle className="text-base">Profile Claim Requests</CardTitle>
          <Badge variant="secondary" className="ml-auto">
            {pendingClaims.length} pending
          </Badge>
        </div>
        <CardDescription>
          Family members want to claim their profiles in your trees
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {pendingClaims.map((claim) => (
          <div key={claim.id} className="border rounded-lg p-4 space-y-3 bg-background">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <p className="font-medium">{claim.memberName}</p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Trees className="h-3 w-3" />
                  <span>{claim.treeName}</span>
                </div>
                {claim.requesterEmail && (
                  <p className="text-sm text-muted-foreground">{claim.requesterEmail}</p>
                )}
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {new Date(claim.createdAt).toLocaleDateString()}
              </div>
            </div>

            {claim.message && (
              <p className="text-sm bg-muted/50 p-2 rounded italic">
                "{claim.message}"
              </p>
            )}

            {showDenyForm[claim.id] ? (
              <div className="space-y-2">
                <Textarea
                  placeholder="Reason for denial (optional)..."
                  value={denialReasons[claim.id] || ""}
                  onChange={(e) => setDenialReasons(prev => ({ ...prev, [claim.id]: e.target.value }))}
                  className="resize-none"
                  rows={2}
                  data-testid={`textarea-deny-reason-${claim.id}`}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => denyMutation.mutate({ claimId: claim.id, reason: denialReasons[claim.id] })}
                    disabled={denyMutation.isPending}
                    data-testid={`button-confirm-deny-${claim.id}`}
                  >
                    Confirm Deny
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setShowDenyForm(prev => ({ ...prev, [claim.id]: false }));
                      setDenialReasons(prev => ({ ...prev, [claim.id]: "" }));
                    }}
                    data-testid={`button-cancel-deny-${claim.id}`}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => approveMutation.mutate(claim.id)}
                  disabled={approveMutation.isPending}
                  className="gap-1"
                  data-testid={`button-approve-claim-${claim.id}`}
                >
                  <CheckCircle className="h-3 w-3" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowDenyForm(prev => ({ ...prev, [claim.id]: true }))}
                  className="gap-1"
                  data-testid={`button-deny-claim-${claim.id}`}
                >
                  <XCircle className="h-3 w-3" />
                  Deny
                </Button>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
