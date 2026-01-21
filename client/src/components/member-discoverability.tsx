import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Users, Mail, User, Calendar, MapPin, Sparkles } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { DiscoverableMember, FamilyMember } from "@shared/schema";

interface MemberDiscoverabilityProps {
  member: FamilyMember;
  canEdit: boolean;
}

interface DiscoverabilitySettings {
  memberId: string;
  isDiscoverable: boolean;
  matchByEmail?: boolean | null;
  matchByName?: boolean | null;
  matchByNickname?: boolean | null;
  matchByBirthdate?: boolean | null;
  matchByBirthplace?: boolean | null;
}

interface PotentialMatch {
  matchScore: number;
  matchCriteria: string[];
  member: {
    id: string;
    firstName: string;
    lastName: string | null;
    treeId: string;
  };
}

export function MemberDiscoverability({ member, canEdit }: MemberDiscoverabilityProps) {
  const { toast } = useToast();
  const [showMatches, setShowMatches] = useState(false);

  const { data: settings, isLoading } = useQuery<DiscoverabilitySettings>({
    queryKey: ['/api/members', member.id, 'discoverability'],
    queryFn: async () => {
      const res = await fetch(`/api/members/${member.id}/discoverability`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  const { data: potentialMatches, isLoading: isLoadingMatches, refetch: refetchMatches } = useQuery<PotentialMatch[]>({
    queryKey: ['/api/members', member.id, 'potential-matches'],
    queryFn: async () => {
      const res = await fetch(`/api/members/${member.id}/potential-matches`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    enabled: showMatches && settings?.isDiscoverable,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<DiscoverabilitySettings>) => {
      return apiRequest('POST', `/api/members/${member.id}/discoverability`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/members', member.id, 'discoverability'] });
      toast({ title: "Settings updated", description: "Discoverability settings have been saved." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update settings.", variant: "destructive" });
    },
  });

  const sendRequestMutation = useMutation({
    mutationFn: async (targetMemberId: string) => {
      return apiRequest('POST', '/api/match-requests', {
        requestingMemberId: member.id,
        targetMemberId,
        message: `Connection request from ${member.firstName} ${member.lastName || ''}`,
      });
    },
    onSuccess: () => {
      toast({ title: "Request sent", description: "Your connection request has been sent." });
      refetchMatches();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to send request.", variant: "destructive" });
    },
  });

  const handleToggle = (field: keyof DiscoverabilitySettings, value: boolean) => {
    const currentSettings = settings || { memberId: member.id, isDiscoverable: false };
    updateMutation.mutate({ ...currentSettings, [field]: value });
  };

  if (isLoading) {
    return (
      <Card className="mt-4">
        <CardContent className="py-4 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  const hasMatchableCriteria = member.email || member.firstName || member.nickname || member.birthDate || member.birthPlace;

  return (
    <Card className="mt-4">
      <CardHeader className="py-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Search className="h-4 w-4" />
            Family Matching
          </CardTitle>
          {settings?.isDiscoverable && (
            <Badge variant="outline" className="text-xs">
              <Sparkles className="h-3 w-3 mr-1" />
              Discoverable
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="py-4 pt-0 space-y-4">
        {canEdit && (
          <>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="discoverable" className="text-sm font-medium">
                  Make discoverable
                </Label>
                <p className="text-xs text-muted-foreground">
                  Allow other users to find potential matches with this person
                </p>
              </div>
              <Switch
                id="discoverable"
                checked={settings?.isDiscoverable ?? false}
                onCheckedChange={(checked) => handleToggle("isDiscoverable", checked)}
                disabled={updateMutation.isPending}
                data-testid="switch-discoverable"
              />
            </div>

            {settings?.isDiscoverable && (
              <div className="border-t pt-4 space-y-3">
                <p className="text-sm font-medium">Match by:</p>
                
                {member.email && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <Label htmlFor="matchEmail" className="text-sm">Email</Label>
                      <Badge variant="secondary" className="text-xs">High confidence</Badge>
                    </div>
                    <Switch
                      id="matchEmail"
                      checked={settings?.matchByEmail ?? false}
                      onCheckedChange={(checked) => handleToggle("matchByEmail", checked)}
                      disabled={updateMutation.isPending}
                      data-testid="switch-match-email"
                    />
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <Label htmlFor="matchName" className="text-sm">Full Name</Label>
                  </div>
                  <Switch
                    id="matchName"
                    checked={settings?.matchByName ?? false}
                    onCheckedChange={(checked) => handleToggle("matchByName", checked)}
                    disabled={updateMutation.isPending}
                    data-testid="switch-match-name"
                  />
                </div>

                {member.nickname && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <Label htmlFor="matchNickname" className="text-sm">Nickname</Label>
                    </div>
                    <Switch
                      id="matchNickname"
                      checked={settings?.matchByNickname ?? false}
                      onCheckedChange={(checked) => handleToggle("matchByNickname", checked)}
                      disabled={updateMutation.isPending}
                      data-testid="switch-match-nickname"
                    />
                  </div>
                )}

                {member.birthDate && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <Label htmlFor="matchBirthdate" className="text-sm">Birth Date</Label>
                    </div>
                    <Switch
                      id="matchBirthdate"
                      checked={settings?.matchByBirthdate ?? false}
                      onCheckedChange={(checked) => handleToggle("matchByBirthdate", checked)}
                      disabled={updateMutation.isPending}
                      data-testid="switch-match-birthdate"
                    />
                  </div>
                )}

                {member.birthPlace && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <Label htmlFor="matchBirthplace" className="text-sm">Birth Place</Label>
                    </div>
                    <Switch
                      id="matchBirthplace"
                      checked={settings?.matchByBirthplace ?? false}
                      onCheckedChange={(checked) => handleToggle("matchByBirthplace", checked)}
                      disabled={updateMutation.isPending}
                      data-testid="switch-match-birthplace"
                    />
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {settings?.isDiscoverable && (
          <div className="border-t pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowMatches(!showMatches);
                if (!showMatches) refetchMatches();
              }}
              className="w-full gap-2"
              data-testid="button-find-matches"
            >
              <Users className="h-4 w-4" />
              {showMatches ? "Hide Matches" : "Find Potential Matches"}
            </Button>

            {showMatches && (
              <div className="mt-4 space-y-3">
                {isLoadingMatches ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : potentialMatches && potentialMatches.length > 0 ? (
                  potentialMatches.map((match) => (
                    <div
                      key={match.member.id}
                      className="p-3 border rounded-lg space-y-2"
                      data-testid={`match-${match.member.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">
                            {match.member.firstName} {match.member.lastName || ''}
                          </p>
                          <div className="flex gap-1 mt-1">
                            {match.matchCriteria.map((criteria) => (
                              <Badge key={criteria} variant="secondary" className="text-xs">
                                {criteria}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {match.matchScore}% match
                          </Badge>
                          {canEdit && (
                            <Button
                              size="sm"
                              onClick={() => sendRequestMutation.mutate(match.member.id)}
                              disabled={sendRequestMutation.isPending}
                              data-testid={`button-connect-${match.member.id}`}
                            >
                              Connect
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-matches">
                    No potential matches found. Enable more matching criteria or wait for others to make their family members discoverable.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {!settings?.isDiscoverable && !canEdit && (
          <p className="text-sm text-muted-foreground" data-testid="text-not-discoverable">
            This member is not set up for family matching.
          </p>
        )}

        {!hasMatchableCriteria && canEdit && (
          <p className="text-xs text-muted-foreground mt-2">
            Add more details like email, nickname, or birth information to enable matching criteria.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
