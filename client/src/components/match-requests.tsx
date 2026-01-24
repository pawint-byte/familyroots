import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Inbox, Send, Check, X, Users, ChevronUp, ChevronDown } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface EnrichedMatchRequest {
  id: string;
  requestingTreeId: string;
  requestingMemberId: string;
  targetTreeId: string;
  targetMemberId: string;
  requestedBy: string;
  status: string;
  matchScore: string | null;
  matchCriteria: string | null;
  message: string | null;
  respondedAt: string | null;
  createdAt: string;
  requestingMember: { id: string; firstName: string; lastName: string | null } | null;
  targetMember: { id: string; firstName: string; lastName: string | null } | null;
  requestingTree?: { id: string; name: string } | null;
  targetTree?: { id: string; name: string } | null;
}

interface MatchRequestsProps {
  treeId: string;
  canEdit: boolean;
}

export function MatchRequests({ treeId, canEdit }: MatchRequestsProps) {
  const { toast } = useToast();
  const [isCollapsed, setIsCollapsed] = useState(true);

  const { data: incomingRequests, isLoading: isLoadingIncoming } = useQuery<EnrichedMatchRequest[]>({
    queryKey: ['/api/trees', treeId, 'match-requests'],
    queryFn: async () => {
      const res = await fetch(`/api/trees/${treeId}/match-requests`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  const { data: sentRequests, isLoading: isLoadingSent } = useQuery<EnrichedMatchRequest[]>({
    queryKey: ['/api/trees', treeId, 'match-requests', 'sent'],
    queryFn: async () => {
      const res = await fetch(`/api/trees/${treeId}/match-requests/sent`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  const respondMutation = useMutation({
    mutationFn: async ({ requestId, status }: { requestId: string; status: 'accepted' | 'declined' }) => {
      return apiRequest('PATCH', `/api/match-requests/${requestId}`, { status });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/trees', treeId, 'match-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/trees', treeId, 'connections'] });
      toast({
        title: variables.status === 'accepted' ? "Request accepted" : "Request declined",
        description: variables.status === 'accepted' 
          ? "The family trees are now connected!" 
          : "The request has been declined.",
      });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to respond to request.", variant: "destructive" });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (requestId: string) => {
      return apiRequest('DELETE', `/api/match-requests/${requestId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trees', treeId, 'match-requests', 'sent'] });
      toast({ title: "Request cancelled", description: "Your connection request has been cancelled." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to cancel request.", variant: "destructive" });
    },
  });

  const pendingIncoming = incomingRequests?.filter(r => r.status === 'pending') || [];
  const pendingSent = sentRequests?.filter(r => r.status === 'pending') || [];

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const totalPending = pendingIncoming.length + pendingSent.length;

  return (
    <Card>
      <CardHeader className="py-2 cursor-pointer" onClick={() => setIsCollapsed(!isCollapsed)}>
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Users className="h-4 w-4" />
          <span className="flex-1">Connection Requests</span>
          {totalPending > 0 && (
            <Badge variant="secondary" className="text-xs">
              {totalPending}
            </Badge>
          )}
          <Button 
            variant="ghost" 
            size="sm"
            onClick={(e) => { e.stopPropagation(); setIsCollapsed(!isCollapsed); }}
            data-testid="button-toggle-requests"
          >
            {isCollapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CardTitle>
      </CardHeader>
      {!isCollapsed && <CardContent className="py-4 pt-0">
        <Tabs defaultValue="incoming">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="incoming" className="gap-2" data-testid="tab-incoming-requests">
              <Inbox className="h-4 w-4" />
              Incoming
              {pendingIncoming.length > 0 && (
                <Badge variant="secondary" className="text-xs ml-1">{pendingIncoming.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="sent" className="gap-2" data-testid="tab-sent-requests">
              <Send className="h-4 w-4" />
              Sent
              {pendingSent.length > 0 && (
                <Badge variant="secondary" className="text-xs ml-1">{pendingSent.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="incoming" className="mt-4 space-y-3">
            {isLoadingIncoming ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : incomingRequests && incomingRequests.length > 0 ? (
              incomingRequests.map((request) => (
                <div
                  key={request.id}
                  className="p-3 border rounded-lg space-y-2"
                  data-testid={`incoming-request-${request.id}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {request.requestingMember?.firstName} {request.requestingMember?.lastName || ''}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        from {request.requestingTree?.name || 'Unknown tree'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Wants to connect with: {request.targetMember?.firstName} {request.targetMember?.lastName || ''}
                      </p>
                      {request.message && (
                        <p className="text-xs mt-2 italic">"{request.message}"</p>
                      )}
                    </div>
                    <Badge variant={request.status === 'pending' ? 'outline' : request.status === 'accepted' ? 'default' : 'secondary'}>
                      {request.status}
                    </Badge>
                  </div>
                  
                  {request.status === 'pending' && canEdit && (
                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => respondMutation.mutate({ requestId: request.id, status: 'declined' })}
                        disabled={respondMutation.isPending}
                        className="flex-1 gap-1"
                        data-testid={`button-decline-${request.id}`}
                      >
                        <X className="h-3 w-3" />
                        Decline
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => respondMutation.mutate({ requestId: request.id, status: 'accepted' })}
                        disabled={respondMutation.isPending}
                        className="flex-1 gap-1"
                        data-testid={`button-accept-${request.id}`}
                      >
                        <Check className="h-3 w-3" />
                        Accept
                      </Button>
                    </div>
                  )}
                  
                  <p className="text-xs text-muted-foreground">
                    {formatDate(request.createdAt)}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-incoming">
                No incoming connection requests
              </p>
            )}
          </TabsContent>

          <TabsContent value="sent" className="mt-4 space-y-3">
            {isLoadingSent ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : sentRequests && sentRequests.length > 0 ? (
              sentRequests.map((request) => (
                <div
                  key={request.id}
                  className="p-3 border rounded-lg space-y-2"
                  data-testid={`sent-request-${request.id}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {request.requestingMember?.firstName} {request.requestingMember?.lastName || ''}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        to {request.targetTree?.name || 'Unknown tree'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Connecting with: {request.targetMember?.firstName} {request.targetMember?.lastName || ''}
                      </p>
                    </div>
                    <Badge variant={request.status === 'pending' ? 'outline' : request.status === 'accepted' ? 'default' : 'secondary'}>
                      {request.status}
                    </Badge>
                  </div>
                  
                  {request.status === 'pending' && canEdit && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => cancelMutation.mutate(request.id)}
                      disabled={cancelMutation.isPending}
                      className="w-full gap-1"
                      data-testid={`button-cancel-${request.id}`}
                    >
                      <X className="h-3 w-3" />
                      Cancel Request
                    </Button>
                  )}
                  
                  <p className="text-xs text-muted-foreground">
                    {formatDate(request.createdAt)}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-sent">
                No sent connection requests
              </p>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>}
    </Card>
  );
}
