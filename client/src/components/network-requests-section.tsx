import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Network, Check, X, TreeDeciduous, ArrowRight } from "lucide-react";

interface NetworkRequest {
  id: string;
  fromTreeId: string;
  toTreeId: string;
  viaTreeId: string;
  viaConnectionId: string;
  status: string;
  message: string;
  createdAt: string;
  fromTreeName: string;
  toTreeName: string;
  viaTreeName: string;
}

export function NetworkRequestsSection() {
  const { toast } = useToast();

  const { data: requests, isLoading } = useQuery<NetworkRequest[]>({
    queryKey: ["/api/user/network-requests"],
  });

  const respondMutation = useMutation({
    mutationFn: async ({ requestId, action }: { requestId: string; action: "approve" | "deny" }) => {
      return apiRequest("POST", `/api/user/network-requests/${requestId}/respond`, { action });
    },
    onSuccess: (_, variables) => {
      toast({
        title: variables.action === "approve" ? "Connection approved" : "Request denied",
        description: variables.action === "approve" 
          ? "Trees are now connected. You can view members from the connected tree."
          : "The connection request has been declined.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user/network-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trees"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to process request",
        variant: "destructive",
      });
    },
  });

  const pendingRequests = requests?.filter(r => r.status === "pending") || [];

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (pendingRequests.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-serif">
          <Network className="h-5 w-5 text-primary" />
          Extended Family Network Requests
        </CardTitle>
        <CardDescription>
          Connection requests from extended family discovered through your network
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {pendingRequests.map((request) => (
            <div 
              key={request.id} 
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-md border bg-muted/30"
              data-testid={`network-request-${request.id}`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <TreeDeciduous className="h-4 w-4 text-primary" />
                  <span>{request.fromTreeName}</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">wants to connect to</span>
                  <span>{request.toTreeName}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Discovered via connection to <span className="font-medium">{request.viaTreeName}</span>
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => respondMutation.mutate({ requestId: request.id, action: "approve" })}
                  disabled={respondMutation.isPending}
                  data-testid={`btn-approve-${request.id}`}
                >
                  <Check className="h-4 w-4 mr-1" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => respondMutation.mutate({ requestId: request.id, action: "deny" })}
                  disabled={respondMutation.isPending}
                  data-testid={`btn-deny-${request.id}`}
                >
                  <X className="h-4 w-4 mr-1" />
                  Deny
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
