import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Link2, Check, X, Users, TreePine, ArrowRight, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface PendingMatch {
  id: string;
  member1Id: string;
  tree1Id: string;
  member2Id: string;
  tree2Id: string;
  matchType: string;
  matchSource: string | null;
  matchScore: number;
  status: string;
  member1: {
    id: string;
    firstName: string;
    lastName: string;
    birthDate: string | null;
    photoUrl: string | null;
  } | null;
  member2: {
    id: string;
    firstName: string;
    lastName: string;
    birthDate: string | null;
    photoUrl: string | null;
  } | null;
  tree1: { id: string; name: string } | null;
  tree2: { id: string; name: string } | null;
  isTree1Yours: boolean;
  isTree2Yours: boolean;
}

export function PendingMatchesSection() {
  const { toast } = useToast();
  
  const { data: pendingMatches, isLoading } = useQuery<PendingMatch[]>({
    queryKey: ["/api/user/pending-matches"],
  });

  const confirmMutation = useMutation({
    mutationFn: async (matchId: string) => {
      return apiRequest("POST", `/api/cross-matches/${matchId}/confirm`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/pending-matches"] });
      toast({
        title: "Match confirmed",
        description: "The family trees are now connected.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to confirm match. Please try again.",
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (matchId: string) => {
      return apiRequest("POST", `/api/cross-matches/${matchId}/reject`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/pending-matches"] });
      toast({
        title: "Match dismissed",
        description: "This suggestion has been removed.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to dismiss match. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!pendingMatches || pendingMatches.length === 0) {
    return null;
  }

  const getMatchTypeLabel = (type: string) => {
    switch (type) {
      case "external_id":
        return "Record Match";
      case "name_date":
        return "Similar Profile";
      case "user_confirmed":
        return "User Linked";
      default:
        return "Potential Match";
    }
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 0.8) return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    if (score >= 0.6) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
    return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
  };

  const formatBirthYear = (date: string | null) => {
    if (!date) return "";
    const year = new Date(date).getFullYear();
    return isNaN(year) ? "" : `b. ${year}`;
  };

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Potential Family Connections</CardTitle>
          <Badge variant="secondary" className="ml-auto">
            {pendingMatches.length} found
          </Badge>
        </div>
        <CardDescription>
          We found people in other family trees who might be the same as members in yours
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {pendingMatches.slice(0, 5).map((match) => {
          const yourMember = match.isTree1Yours ? match.member1 : match.member2;
          const otherMember = match.isTree1Yours ? match.member2 : match.member1;
          const yourTree = match.isTree1Yours ? match.tree1 : match.tree2;
          const otherTree = match.isTree1Yours ? match.tree2 : match.tree1;

          return (
            <div
              key={match.id}
              className="flex items-center gap-4 p-4 rounded-lg border bg-card"
              data-testid={`match-card-${match.id}`}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarImage src={yourMember?.photoUrl || undefined} />
                  <AvatarFallback>
                    {yourMember?.firstName?.[0]}{yourMember?.lastName?.[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="font-medium truncate">
                    {yourMember?.firstName} {yourMember?.lastName}
                  </p>
                  <p className="text-sm text-muted-foreground truncate">
                    {yourTree?.name} {formatBirthYear(yourMember?.birthDate || null)}
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-center gap-1 px-2">
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <Badge variant="outline" className={getConfidenceColor(match.matchScore)}>
                  {Math.round(match.matchScore * 100)}%
                </Badge>
              </div>

              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarImage src={otherMember?.photoUrl || undefined} />
                  <AvatarFallback>
                    {otherMember?.firstName?.[0]}{otherMember?.lastName?.[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="font-medium truncate">
                    {otherMember?.firstName} {otherMember?.lastName}
                  </p>
                  <p className="text-sm text-muted-foreground truncate">
                    {otherTree?.name} {formatBirthYear(otherMember?.birthDate || null)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => rejectMutation.mutate(match.id)}
                  disabled={rejectMutation.isPending || confirmMutation.isPending}
                  data-testid={`button-reject-match-${match.id}`}
                >
                  <X className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  onClick={() => confirmMutation.mutate(match.id)}
                  disabled={confirmMutation.isPending || rejectMutation.isPending}
                  data-testid={`button-confirm-match-${match.id}`}
                >
                  <Check className="h-4 w-4 mr-1" />
                  Connect
                </Button>
              </div>
            </div>
          );
        })}

        {pendingMatches.length > 5 && (
          <p className="text-sm text-muted-foreground text-center pt-2">
            + {pendingMatches.length - 5} more potential matches
          </p>
        )}
      </CardContent>
    </Card>
  );
}
