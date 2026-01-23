import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Shield, User, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import type { CustodianshipRequest, FamilyMember } from "@shared/schema";

interface CustodianshipSectionProps {
  member: FamilyMember;
  currentUserId: string;
  isTreeOwner: boolean;
}

const RELATIONSHIP_OPTIONS = [
  { value: "parent", label: "Parent" },
  { value: "child", label: "Child" },
  { value: "spouse", label: "Spouse" },
  { value: "sibling", label: "Sibling" },
];

export function CustodianshipSection({ member, currentUserId, isTreeOwner }: CustodianshipSectionProps) {
  const { toast } = useToast();
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [relationship, setRelationship] = useState("");
  const [reason, setReason] = useState("");

  const { data: requests = [], isLoading } = useQuery<CustodianshipRequest[]>({
    queryKey: ['/api/members', member.id, 'custodianship'],
    enabled: !!member.id && !!member.deathDate,
  });

  const requestMutation = useMutation({
    mutationFn: async (data: { relationshipToMember: string; reason: string }) => {
      return apiRequest('POST', `/api/members/${member.id}/custodianship`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/members', member.id, 'custodianship'] });
      setIsRequestDialogOpen(false);
      setRelationship("");
      setReason("");
      toast({ 
        title: "Request submitted", 
        description: "Your custodianship request has been submitted. The tree owner has 30 days to respond." 
      });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to submit request", variant: "destructive" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (requestId: string) => {
      return apiRequest('POST', `/api/custodianship/${requestId}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/members', member.id, 'custodianship'] });
      queryClient.invalidateQueries({ queryKey: ['/api/members', member.id] });
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
      queryClient.invalidateQueries({ queryKey: ['/api/members', member.id, 'custodianship'] });
      toast({ title: "Denied", description: "Custodianship request has been denied." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to deny request", variant: "destructive" });
    },
  });

  // Only show for deceased members
  if (!member.deathDate) {
    return null;
  }

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const userHasPendingRequest = pendingRequests.some(r => r.requesterId === currentUserId);
  const hasCustodian = !!member.custodianUserId;
  const isCurrentUserCustodian = member.custodianUserId === currentUserId;

  const handleSubmitRequest = () => {
    if (!relationship) {
      toast({ title: "Missing information", description: "Please select your relationship to this person", variant: "destructive" });
      return;
    }
    requestMutation.mutate({ relationshipToMember: relationship, reason });
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getDaysRemaining = (expiresAt: Date | string) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diffTime = expires.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Shield className="h-5 w-5" />
          Profile Custodianship
        </CardTitle>
        <CardDescription>
          Manage who can edit this deceased member's profile information
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasCustodian ? (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              {isCurrentUserCustodian 
                ? "You are the custodian of this profile and can edit their information."
                : "This profile has an assigned custodian who manages the information."}
            </AlertDescription>
          </Alert>
        ) : (
          <>
            {!isTreeOwner && !userHasPendingRequest && (
              <Dialog open={isRequestDialogOpen} onOpenChange={setIsRequestDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full" data-testid="button-request-custodianship">
                    <User className="h-4 w-4 mr-2" />
                    Request Custodianship
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Request Profile Custodianship</DialogTitle>
                    <DialogDescription>
                      As a direct relative, you can request to become the custodian of {member.firstName}'s profile.
                      The tree owner has 30 days to approve or deny. If no action is taken, the request is automatically approved.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="relationship">Your Relationship to {member.firstName}</Label>
                      <Select value={relationship} onValueChange={setRelationship}>
                        <SelectTrigger data-testid="select-relationship">
                          <SelectValue placeholder="Select relationship" />
                        </SelectTrigger>
                        <SelectContent>
                          {RELATIONSHIP_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reason">Reason for Request (optional)</Label>
                      <Textarea
                        id="reason"
                        placeholder="Explain why you'd like to become the custodian..."
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        rows={3}
                        data-testid="input-custodianship-reason"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsRequestDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleSubmitRequest} 
                      disabled={requestMutation.isPending}
                      data-testid="button-submit-custodianship"
                    >
                      {requestMutation.isPending ? "Submitting..." : "Submit Request"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}

            {userHasPendingRequest && (
              <Alert>
                <Clock className="h-4 w-4" />
                <AlertDescription>
                  You have a pending custodianship request for this profile. The tree owner will review it within 30 days.
                </AlertDescription>
              </Alert>
            )}
          </>
        )}

        {/* Show pending requests to tree owner */}
        {isTreeOwner && pendingRequests.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium text-sm">Pending Custodianship Requests</h4>
            {pendingRequests.map(request => (
              <div 
                key={request.id} 
                className="flex items-start justify-between gap-3 p-3 rounded-lg border bg-card"
                data-testid={`custodianship-request-${request.id}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="secondary">{request.relationshipToMember}</Badge>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {getDaysRemaining(request.expiresAt)} days remaining
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Requested by: {request.requesterEmail || "Unknown"}
                  </p>
                  {request.reason && (
                    <p className="text-sm mt-1">{request.reason}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Submitted: {formatDate(request.createdAt)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-green-600 hover:text-green-700"
                    onClick={() => approveMutation.mutate(request.id)}
                    disabled={approveMutation.isPending}
                    data-testid={`button-approve-custodianship-${request.id}`}
                  >
                    <CheckCircle className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => denyMutation.mutate(request.id)}
                    disabled={denyMutation.isPending}
                    data-testid={`button-deny-custodianship-${request.id}`}
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              <AlertCircle className="h-3 w-3 inline mr-1" />
              Requests are auto-approved after 30 days if no action is taken.
            </p>
          </div>
        )}

        {isLoading && (
          <div className="animate-pulse space-y-2">
            <div className="h-10 bg-muted rounded" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
