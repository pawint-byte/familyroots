import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, RefreshCw, Check, Clock, MousePointer, UserPlus, Trash2 } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface MemberInvitation {
  id: string;
  email: string;
  memberId: string;
  treeId: string;
  treeName: string;
  invitedBy: string;
  inviterName: string;
  memberName: string;
  status: 'pending' | 'clicked' | 'registered';
  sentAt: string;
  clickedAt: string | null;
  registeredAt: string | null;
}

interface InvitationStatusProps {
  treeId: string;
}

export function InvitationStatus({ treeId }: InvitationStatusProps) {
  const { toast } = useToast();

  const { data: invitations = [], isLoading } = useQuery<MemberInvitation[]>({
    queryKey: ['/api/trees', treeId, 'member-invitations'],
    enabled: !!treeId,
  });

  const resendMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const response = await apiRequest(
        "POST",
        `/api/trees/${treeId}/member-invitations/${invitationId}/resend`
      );
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Invitation Resent",
        description: "The invitation email has been sent again.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/trees', treeId, 'member-invitations'] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Resend",
        description: error?.message || "Could not resend the invitation.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      await apiRequest(
        "DELETE",
        `/api/trees/${treeId}/member-invitations/${invitationId}`
      );
    },
    onSuccess: () => {
      toast({
        title: "Invitation Deleted",
        description: "The invitation has been removed.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/trees', treeId, 'member-invitations'] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Delete",
        description: error?.message || "Could not delete the invitation.",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Email Invitations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  if (invitations.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Email Invitations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No invitations sent yet. Add family members with email addresses to invite them.
          </p>
        </CardContent>
      </Card>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'registered':
        return (
          <Badge variant="default" className="bg-green-500/20 text-green-600 border-green-500/30">
            <UserPlus className="h-3 w-3 mr-1" />
            Registered
          </Badge>
        );
      case 'clicked':
        return (
          <Badge variant="default" className="bg-blue-500/20 text-blue-600 border-blue-500/30">
            <MousePointer className="h-3 w-3 mr-1" />
            Clicked Link
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Mail className="h-4 w-4" />
          Email Invitations ({invitations.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {invitations.map((invitation) => (
          <div
            key={invitation.id}
            className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/50"
            data-testid={`invitation-${invitation.id}`}
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{invitation.memberName}</p>
              <p className="text-xs text-muted-foreground truncate">{invitation.email}</p>
              <p className="text-xs text-muted-foreground">
                Sent: {formatDate(invitation.sentAt)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {getStatusBadge(invitation.status)}
              {invitation.status === 'pending' && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => resendMutation.mutate(invitation.id)}
                  disabled={resendMutation.isPending}
                  title="Resend invitation"
                  data-testid={`resend-invitation-${invitation.id}`}
                >
                  <RefreshCw className={`h-4 w-4 ${resendMutation.isPending ? 'animate-spin' : ''}`} />
                </Button>
              )}
              {invitation.status === 'registered' && (
                <Check className="h-4 w-4 text-green-500" />
              )}
              <Button
                size="icon"
                variant="ghost"
                onClick={() => deleteMutation.mutate(invitation.id)}
                disabled={deleteMutation.isPending}
                title="Delete invitation"
                data-testid={`delete-invitation-${invitation.id}`}
                className="text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
