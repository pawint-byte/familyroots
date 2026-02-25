import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Check, X, Loader2, Heart, TreePine } from "lucide-react";
import { Link } from "wouter";
import { TREE_TYPE_CONFIGS, type TreeType } from "@shared/treeTypes";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PendingConnectionRequest {
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
  targetTreeType: string | null;
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

const FAMILY_APPROVER_OPTIONS = [
  { value: "parent", label: "Their Parent" },
  { value: "son", label: "Their Son" },
  { value: "daughter", label: "Their Daughter" },
  { value: "spouse", label: "Their Spouse" },
  { value: "sibling", label: "Their Sibling" },
  { value: "grandparent", label: "Their Grandparent" },
  { value: "grandchild", label: "Their Grandchild" },
  { value: "aunt", label: "Their Aunt" },
  { value: "uncle", label: "Their Uncle" },
  { value: "niece", label: "Their Niece" },
  { value: "nephew", label: "Their Nephew" },
  { value: "cousin", label: "Their Cousin" },
  { value: "in_law", label: "Their In-Law" },
  { value: "step_relative", label: "Their Step-Relative" },
  { value: "other", label: "Other (specify)" },
];

function getApproverOptionsForTreeType(treeType?: string | null) {
  if (!treeType || treeType === "family") return FAMILY_APPROVER_OPTIONS;
  const config = TREE_TYPE_CONFIGS[treeType as TreeType];
  if (!config) return FAMILY_APPROVER_OPTIONS;
  return [
    ...config.defaultRelationshipTypes.map(r => ({
      value: r.value,
      label: r.label,
    })),
    { value: "other", label: "Other (specify)" },
  ];
}

export function PendingConnectionsSection() {
  const { toast } = useToast();
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<PendingConnectionRequest | null>(null);
  const [approverRelationship, setApproverRelationship] = useState("");
  const [approverCustomLabel, setApproverCustomLabel] = useState("");

  const { data: pendingRequests = [], isLoading } = useQuery<PendingConnectionRequest[]>({
    queryKey: ["/api/user-connection-requests/pending"],
  });

  const approveMutation = useMutation({
    mutationFn: async ({ requestId, relationshipType, customLabel }: { requestId: string; relationshipType?: string; customLabel?: string }) => {
      const res = await fetch(`/api/user-connection-requests/${requestId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ relationshipType, customLabel }),
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
      setApprovalDialogOpen(false);
      setSelectedRequest(null);
      setApproverRelationship("");
      setApproverCustomLabel("");
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

  const handleApproveClick = (request: PendingConnectionRequest) => {
    setSelectedRequest(request);
    setApprovalDialogOpen(true);
  };

  const handleConfirmApproval = () => {
    if (!selectedRequest) return;
    
    approveMutation.mutate({
      requestId: selectedRequest.id,
      relationshipType: approverRelationship || undefined,
      customLabel: approverRelationship === "other" ? approverCustomLabel : undefined,
    });
  };

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
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Connection Requests</CardTitle>
          </div>
          <CardDescription>
            People who want to connect with you
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {pendingRequests.map((request) => {
              const displayName = [request.fromUser?.firstName, request.fromUser?.lastName].filter(Boolean).join(' ') || 'Unknown User';
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
                    <div className="font-medium" data-testid={`text-requester-name-${request.id}`}>
                      {displayName}
                    </div>
                    <div className="mt-1.5 space-y-1">
                      <p className="text-sm" data-testid={`text-relationship-claim-${request.id}`}>
                        <span className="text-muted-foreground">Claims to be </span>
                        <Badge variant="secondary" className="text-xs" data-testid={`badge-relationship-${request.id}`}>
                          {relationshipLabel}
                        </Badge>
                      </p>
                      {request.targetTreeName && (
                        <p className="text-sm" data-testid={`text-tree-context-${request.id}`}>
                          <span className="text-muted-foreground">Wants to join </span>
                          {request.targetTreeId ? (
                            <Link
                              href={`/tree/${request.targetTreeId}`}
                              className="font-semibold text-foreground hover:underline inline-flex items-center gap-1"
                              data-testid={`link-tree-${request.id}`}
                            >
                              <TreePine className="h-3 w-3 inline" />
                              {request.targetTreeName}
                            </Link>
                          ) : (
                            <span className="font-semibold text-foreground">{request.targetTreeName}</span>
                          )}
                        </p>
                      )}
                      <p className="text-sm" data-testid={`text-your-role-${request.id}`}>
                        <span className="text-muted-foreground">If you accept, you'll be added as </span>
                        <Badge variant="outline" className="text-xs">
                          {(() => {
                            const REVERSE_ROLES: Record<string, string> = {
                              son: "Their Parent",
                              daughter: "Their Parent",
                              parent: "Their Child",
                              spouse: "Their Spouse",
                              sibling: "Their Sibling",
                              grandparent: "Their Grandchild",
                              grandchild: "Their Grandparent",
                              aunt: "Their Niece/Nephew",
                              uncle: "Their Niece/Nephew",
                              niece: "Their Aunt/Uncle",
                              nephew: "Their Aunt/Uncle",
                              cousin: "Their Cousin",
                              in_law: "Their In-Law",
                              step_relative: "Their Step-Relative",
                              other: "Connected",
                            };
                            return REVERSE_ROLES[request.relationshipType] || "Connected";
                          })()}
                        </Badge>
                      </p>
                    </div>
                    {request.sourceType === "qr_scan" && (
                      <Badge variant="outline" className="text-xs mt-1">
                        Via QR Scan
                      </Badge>
                    )}
                    {request.message && (
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2 italic">
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
                      onClick={() => handleApproveClick(request)}
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

      <Dialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Accept Connection</DialogTitle>
            <DialogDescription>
              <span className="font-semibold text-foreground">
                {[selectedRequest?.fromUser?.firstName, selectedRequest?.fromUser?.lastName].filter(Boolean).join(' ') || 'Someone'}
              </span>
              {" "}says they're{" "}
              <span className="font-medium text-foreground">
                {selectedRequest?.customLabel || RELATIONSHIP_LABELS[selectedRequest?.relationshipType || ""] || selectedRequest?.relationshipType}
              </span>
              {selectedRequest?.targetTreeName && (
                <>
                  {" "}and wants to connect to{" "}
                  <span className="font-medium text-foreground">{selectedRequest.targetTreeName}</span>
                </>
              )}
              . How would you describe your connection to them?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="approver-relationship">
                {selectedRequest?.targetTreeType && selectedRequest.targetTreeType !== "family"
                  ? "My role..."
                  : "I am their..."}
              </Label>
              <Select
                value={approverRelationship}
                onValueChange={setApproverRelationship}
              >
                <SelectTrigger id="approver-relationship" data-testid="select-approver-relationship">
                  <SelectValue placeholder="Select your role or relationship (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {getApproverOptionsForTreeType(selectedRequest?.targetTreeType).map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                You can have a different perspective on the connection than they do.
              </p>
            </div>

            {approverRelationship === "other" && (
              <div className="space-y-2">
                <Label htmlFor="approver-custom-label">Describe your connection</Label>
                <Input
                  id="approver-custom-label"
                  value={approverCustomLabel}
                  onChange={(e) => setApproverCustomLabel(e.target.value)}
                  placeholder="e.g., Team supporter, Coach, Friend..."
                  maxLength={100}
                  data-testid="input-approver-custom-label"
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setApprovalDialogOpen(false)}
              data-testid="button-cancel-approval"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmApproval}
              disabled={approveMutation.isPending}
              data-testid="button-confirm-approval"
            >
              {approveMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Accept Connection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
