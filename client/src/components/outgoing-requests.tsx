import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Send, X, Loader2 } from "lucide-react";
import { Link } from "wouter";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState } from "react";

interface OutgoingConnectionRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  relationshipType: string;
  customLabel: string | null;
  message: string | null;
  status: string;
  sourceType: string | null;
  targetTreeId: string | null;
  targetTreeName: string | null;
  createdAt: string;
  toUser: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
  } | null;
}

const RELATIONSHIP_LABELS: Record<string, string> = {
  son: "Son",
  daughter: "Daughter",
  parent: "Parent",
  spouse: "Spouse",
  sibling: "Sibling",
  grandparent: "Grandparent",
  grandchild: "Grandchild",
  aunt: "Aunt",
  uncle: "Uncle",
  niece: "Niece",
  nephew: "Nephew",
  cousin: "Cousin",
  in_law: "In-Law",
  step_relative: "Step-Relative",
  other: "Other",
};

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  pending: { label: "Pending", variant: "secondary" },
  approved: { label: "Approved", variant: "default" },
  denied: { label: "Declined", variant: "destructive" },
  expired: { label: "Cancelled", variant: "outline" },
};

export function OutgoingRequestsSection() {
  const { toast } = useToast();
  const [cancelTarget, setCancelTarget] = useState<{ id: string; name: string } | null>(null);

  const { data: sentRequests = [], isLoading } = useQuery<OutgoingConnectionRequest[]>({
    queryKey: ["/api/user-connection-requests/sent"],
  });

  const cancelMutation = useMutation({
    mutationFn: async (requestId: string) => {
      await apiRequest("POST", `/api/user-connection-requests/${requestId}/cancel`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-connection-requests/sent"] });
      toast({ title: "Request cancelled" });
      setCancelTarget(null);
    },
    onError: () => {
      toast({ title: "Failed to cancel request", variant: "destructive" });
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
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (sentRequests.length === 0) {
    return null;
  }

  return (
    <>
      <Card data-testid="outgoing-requests-section">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Sent Connection Requests</CardTitle>
          </div>
          <CardDescription>
            Connection requests you've sent
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {sentRequests.map((request) => {
              const toUser = request.toUser;
              if (!toUser) return null;

              const firstName = toUser.firstName || "";
              const lastName = toUser.lastName || "";
              const fullName = `${firstName} ${lastName}`.trim() || "Member";
              const initials = `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase() || "?";

              const relationshipLabel = request.customLabel ||
                RELATIONSHIP_LABELS[request.relationshipType] ||
                request.relationshipType;

              const statusInfo = STATUS_LABELS[request.status] || { label: request.status, variant: "outline" as const };
              const isPending = request.status === "pending";

              return (
                <div
                  key={request.id}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-lg border bg-card"
                  data-testid={`outgoing-request-${request.id}`}
                >
                  <Avatar className="h-12 w-12 shrink-0">
                    <AvatarImage src={toUser.profileImageUrl || undefined} />
                    <AvatarFallback className="bg-primary/10">{initials}</AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="font-medium" data-testid={`text-outgoing-name-${request.id}`}>
                      {fullName}
                    </div>
                    <div className="text-sm text-muted-foreground mt-0.5" data-testid={`text-outgoing-context-${request.id}`}>
                      {request.targetTreeName ? (
                        <>
                          You requested to connect to{" "}
                          <Link
                            href={`/tree/${request.targetTreeId}`}
                            className="font-semibold text-foreground hover:underline"
                            data-testid={`link-outgoing-tree-${request.id}`}
                          >
                            {request.targetTreeName}
                          </Link>
                          {" "}as their {relationshipLabel}
                        </>
                      ) : (
                        <>You requested to connect as their {relationshipLabel}</>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <Badge variant={statusInfo.variant} className="text-xs" data-testid={`badge-status-${request.id}`}>
                        {statusInfo.label}
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

                  {isPending && (
                    <div className="flex items-center shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setCancelTarget({ id: request.id, name: fullName })}
                        disabled={cancelMutation.isPending}
                        data-testid={`button-cancel-request-${request.id}`}
                      >
                        {cancelMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <X className="h-4 w-4" />
                        )}
                        <span className="ml-1">Cancel</span>
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!cancelTarget} onOpenChange={() => setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Connection Request</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel your connection request to {cancelTarget?.name}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Request</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => cancelTarget && cancelMutation.mutate(cancelTarget.id)}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? "Cancelling..." : "Cancel Request"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
