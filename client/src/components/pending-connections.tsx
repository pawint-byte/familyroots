import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { UserPlus, Check, X, Loader2, Users, Heart } from "lucide-react";

interface PendingConnectionRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  relationshipType: string;
  customLabel: string | null;
  message: string | null;
  status: string;
  sourceType: string | null;
  createdAt: string;
  fromUser: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
  } | null;
}

const RELATIONSHIP_LABELS: Record<string, string> = {
  son: "Your Son",
  daughter: "Your Daughter",
  parent: "Your Parent",
  spouse: "Your Spouse",
  sibling: "Your Sibling",
  grandparent: "Your Grandparent",
  grandchild: "Your Grandchild",
  aunt: "Your Aunt",
  uncle: "Your Uncle",
  niece: "Your Niece",
  nephew: "Your Nephew",
  cousin: "Your Cousin",
  in_law: "Your In-Law",
  step_relative: "Your Step-Relative",
  other: "Related to You",
};

export function PendingConnectionsSection() {
  const { toast } = useToast();

  const { data: pendingRequests = [], isLoading } = useQuery<PendingConnectionRequest[]>({
    queryKey: ["/api/user-connection-requests/pending"],
  });

  const approveMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const res = await fetch(`/api/user-connection-requests/${requestId}/approve`, {
        method: "POST",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to approve request");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Connection Approved!",
        description: data.message || "You are now connected.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user-connection-requests/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user-connections"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to approve request",
        variant: "destructive",
      });
    },
  });

  const denyMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const res = await fetch(`/api/user-connection-requests/${requestId}/deny`, {
        method: "POST",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to deny request");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Request Denied",
        description: "The connection request has been declined.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user-connection-requests/pending"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to deny request",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-1" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg border">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24 mt-1" />
                </div>
                <Skeleton className="h-8 w-16" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (pendingRequests.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Heart className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Family Connection Requests</CardTitle>
        </div>
        <CardDescription>
          People who want to connect with you as family
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {pendingRequests.map((request) => {
            const initials = `${request.fromUser?.firstName?.[0] || ''}${request.fromUser?.lastName?.[0] || ''}`.toUpperCase() || '?';
            const relationshipLabel = request.customLabel || RELATIONSHIP_LABELS[request.relationshipType] || request.relationshipType;
            const isPending = approveMutation.isPending || denyMutation.isPending;

            return (
              <div
                key={request.id}
                className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-lg border bg-card"
                data-testid={`connection-request-${request.id}`}
              >
                <Avatar className="h-12 w-12 shrink-0">
                  <AvatarImage src={request.fromUser?.profileImageUrl || undefined} />
                  <AvatarFallback className="bg-primary/10">{initials}</AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="font-medium">
                    {request.fromUser?.firstName} {request.fromUser?.lastName}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="text-xs">
                      {relationshipLabel}
                    </Badge>
                    {request.sourceType === "qr_scan" && (
                      <Badge variant="outline" className="text-xs">
                        QR Scan
                      </Badge>
                    )}
                  </div>
                  {request.message && (
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                      "{request.message}"
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 sm:shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => denyMutation.mutate(request.id)}
                    disabled={isPending}
                    data-testid={`button-deny-${request.id}`}
                  >
                    {denyMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <X className="h-4 w-4" />
                    )}
                    <span className="sr-only sm:not-sr-only sm:ml-1">Decline</span>
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => approveMutation.mutate(request.id)}
                    disabled={isPending}
                    data-testid={`button-approve-${request.id}`}
                  >
                    {approveMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    <span className="sr-only sm:not-sr-only sm:ml-1">Accept</span>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
