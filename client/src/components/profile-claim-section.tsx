import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { UserCheck, Clock, XCircle, CheckCircle, Send, UserMinus, AlertTriangle } from "lucide-react";
import type { FamilyMember } from "@shared/schema";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ClaimStatus {
  status: 'available' | 'pending' | 'approved' | 'denied' | 'owned' | 'claimed_by_other';
  claimId?: string;
  claimedAt?: string;
  denialReason?: string;
}

interface ProfileClaimSectionProps {
  member: FamilyMember;
  isOwner: boolean;
}

export function ProfileClaimSection({ member, isOwner }: ProfileClaimSectionProps) {
  const [claimMessage, setClaimMessage] = useState("");
  const [showClaimForm, setShowClaimForm] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: claimStatus, isLoading } = useQuery<ClaimStatus>({
    queryKey: ['/api/members', member.id, 'claim-status'],
    queryFn: async () => {
      const response = await fetch(`/api/members/${member.id}/claim-status`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch claim status');
      return response.json();
    },
    enabled: !isOwner && member.isLiving !== false, // Query only runs for living members in non-owned trees
  });

  const unclaimMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/members/${member.id}/unclaim`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Disassociated from profile",
        description: "You have been removed from this profile. The tree owner's original entry has been preserved.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/members', member.id, 'claim-status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/trees'] });
      queryClient.invalidateQueries({ queryKey: ['/api/members'] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to disassociate",
        description: error?.message || "Please try again later.",
        variant: "destructive",
      });
    },
  });

  const submitClaimMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/members/${member.id}/claim`, {
        message: claimMessage || undefined,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Claim request submitted",
        description: "The tree owner will review your request.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/members', member.id, 'claim-status'] });
      setShowClaimForm(false);
      setClaimMessage("");
    },
    onError: (error: any) => {
      toast({
        title: "Failed to submit claim",
        description: error?.message || "Please try again later.",
        variant: "destructive",
      });
    },
  });

  // Only hide if user owns the tree or member is explicitly marked as deceased
  if (isOwner || member.isLiving === false) {
    return null;
  }

  if (isLoading) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4 animate-pulse" />
            <span className="text-sm">Checking claim status...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (claimStatus?.status === 'owned') {
    return (
      <Card className="border-primary/50 bg-primary/5">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-primary">
                <UserCheck className="h-5 w-5" />
                <span className="font-medium">This is your profile</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                You claimed this profile on {claimStatus.claimedAt ? new Date(claimStatus.claimedAt).toLocaleDateString() : 'a previous date'}.
                You can edit your personal details.
              </p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-border/50">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive gap-2" data-testid="button-disassociate">
                  <UserMinus className="h-4 w-4" />
                  Disassociate from this tree
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    Disassociate from this tree?
                  </AlertDialogTitle>
                  <AlertDialogDescription className="space-y-2">
                    <p>This will remove your connection to this profile. Here's what happens:</p>
                    <ul className="list-disc pl-5 space-y-1 text-sm">
                      <li>Your personal data (photo, bio, contact info) will be removed from this tree</li>
                      <li>The tree owner's original entry (your name, relationships) will stay on the tree</li>
                      <li>You will lose access to this tree as a collaborator</li>
                      <li>You can request to re-claim this profile later if you change your mind</li>
                    </ul>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel data-testid="button-cancel-disassociate">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => unclaimMutation.mutate()}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    disabled={unclaimMutation.isPending}
                    data-testid="button-confirm-disassociate"
                  >
                    {unclaimMutation.isPending ? "Disassociating..." : "Yes, disassociate me"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (claimStatus?.status === 'claimed_by_other') {
    return (
      <Card className="border-dashed">
        <CardContent className="py-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <UserCheck className="h-4 w-4" />
            <span className="text-sm">This profile has been claimed by another user</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (claimStatus?.status === 'pending') {
    return (
      <Card className="border-yellow-500/50 bg-yellow-500/5">
        <CardContent className="py-4">
          <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
            <Clock className="h-5 w-5" />
            <span className="font-medium">Claim request pending</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Waiting for the tree owner to review your claim request.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (claimStatus?.status === 'denied') {
    return (
      <Card className="border-destructive/50 bg-destructive/5">
        <CardContent className="py-4">
          <div className="flex items-center gap-2 text-destructive">
            <XCircle className="h-5 w-5" />
            <span className="font-medium">Claim request denied</span>
          </div>
          {claimStatus.denialReason && (
            <p className="text-sm text-muted-foreground mt-1">
              Reason: {claimStatus.denialReason}
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  if (showClaimForm) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Claim This Profile</CardTitle>
          <CardDescription>
            Is this you? Request to claim this profile to manage your own information.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="Add a message to the tree owner (optional)..."
            value={claimMessage}
            onChange={(e) => setClaimMessage(e.target.value)}
            className="resize-none"
            rows={3}
            data-testid="textarea-claim-message"
          />
          <div className="flex gap-2">
            <Button
              onClick={() => submitClaimMutation.mutate()}
              disabled={submitClaimMutation.isPending}
              className="gap-2"
              data-testid="button-submit-claim"
            >
              <Send className="h-4 w-4" />
              {submitClaimMutation.isPending ? "Submitting..." : "Submit Claim"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setShowClaimForm(false);
                setClaimMessage("");
              }}
              data-testid="button-cancel-claim"
            >
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-dashed hover-elevate cursor-pointer" onClick={() => setShowClaimForm(true)}>
      <CardContent className="py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-primary" />
            <div>
              <p className="font-medium text-sm">Is this you?</p>
              <p className="text-xs text-muted-foreground">Claim this profile to manage your information</p>
            </div>
          </div>
          <Button variant="outline" size="sm" data-testid="button-claim-profile">
            Claim Profile
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
