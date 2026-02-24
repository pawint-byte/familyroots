import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Search, User, Calendar, MapPin, ArrowLeftRight, CheckCircle,
  Send, Loader2, Users, GitMerge, AlertTriangle
} from "lucide-react";

interface SmartMatchMember {
  id: string;
  firstName: string;
  lastName?: string | null;
  birthDate?: string | null;
  birthPlace?: string | null;
  gender?: string | null;
  treeId?: string;
}

interface SmartMatchResult {
  sourceMember: SmartMatchMember;
  targetMember: SmartMatchMember;
  targetTree: { id: string; name: string };
  matchScore: number;
  matchCriteria: string[];
  alreadyRequested: boolean;
}

interface SmartMatchResponse {
  matches: SmartMatchResult[];
  summary: {
    scannedTrees: number;
    totalCompared: number;
    matchesFound: number;
  };
}

interface SmartMatchDialogProps {
  treeId: string;
  treeName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function SmartMatchDialog({ treeId, treeName, open, onOpenChange }: SmartMatchDialogProps) {
  const { toast } = useToast();
  const [hasScanned, setHasScanned] = useState(false);
  const [scanResults, setScanResults] = useState<SmartMatchResponse | null>(null);
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());

  const scanMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/trees/${treeId}/smart-match-scan`, {});
      return res.json() as Promise<SmartMatchResponse>;
    },
    onSuccess: (data) => {
      setScanResults(data);
      setHasScanned(true);
      if (data.matches.length === 0) {
        toast({
          title: "No Matches Found",
          description: `Scanned ${data.summary.scannedTrees} connected tree${data.summary.scannedTrees !== 1 ? 's' : ''} — no shared members detected.`,
        });
      }
    },
    onError: () => {
      toast({
        title: "Scan Failed",
        description: "Could not complete the smart match scan. Please try again.",
        variant: "destructive",
      });
    },
  });

  const sendRequestMutation = useMutation({
    mutationFn: async ({ requestingMemberId, targetMemberId, message }: { requestingMemberId: string; targetMemberId: string; message?: string }) => {
      const res = await apiRequest("POST", "/api/match-requests", {
        requestingMemberId,
        targetMemberId,
        message,
      });
      return res.json();
    },
    onSuccess: (_, variables) => {
      const pairKey = `${variables.requestingMemberId}:${variables.targetMemberId}`;
      setSentRequests(prev => new Set(prev).add(pairKey));
      toast({
        title: "Match Request Sent",
        description: "The other tree's owner will be notified and can approve the connection.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/trees", treeId, "match-requests"] });
    },
    onError: () => {
      toast({
        title: "Request Failed",
        description: "Could not send the match request. Please try again.",
        variant: "destructive",
      });
    },
  });

  const formatDate = (date: string | null | undefined) => {
    if (!date) return null;
    const yearMatch = date.match(/\d{4}/);
    return yearMatch ? yearMatch[0] : date;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-red-600 dark:text-red-400";
    if (score >= 60) return "text-amber-600 dark:text-amber-400";
    return "text-yellow-600 dark:text-yellow-400";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return "Strong Match";
    if (score >= 60) return "Likely Match";
    return "Possible Match";
  };

  const getCriteriaLabel = (c: string) => {
    switch (c) {
      case "firstName": return "First Name";
      case "lastName": return "Last Name";
      case "birthYear": return "Birth Year";
      case "birthYearClose": return "Birth Year (close)";
      case "birthPlace": return "Birth Place";
      case "birthPlacePartial": return "Birth Place (partial)";
      case "gender": return "Gender";
      case "email": return "Email";
      default: return c;
    }
  };

  const isPairRequested = (sourceId: string, targetId: string) => {
    return sentRequests.has(`${sourceId}:${targetId}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" data-testid="dialog-smart-match">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" data-testid="text-smart-match-title">
            <Search className="h-5 w-5" />
            Smart Match
          </DialogTitle>
          <DialogDescription>
            Scan connected trees to find people who might appear in both your tree and another. Matches are based on name, birth year, birth place, and gender.
          </DialogDescription>
        </DialogHeader>

        {!hasScanned ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="text-center space-y-2">
              <Users className="h-12 w-12 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Compare members in <strong>{treeName}</strong> against all connected trees to find potential shared members.
              </p>
            </div>
            <Button
              onClick={() => scanMutation.mutate()}
              disabled={scanMutation.isPending}
              size="lg"
              data-testid="button-start-scan"
            >
              {scanMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Scanning...</>
              ) : (
                <><Search className="h-4 w-4 mr-2" /> Scan Connected Trees</>
              )}
            </Button>
          </div>
        ) : scanResults && scanResults.matches.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <CheckCircle className="h-12 w-12 text-green-500" />
            <p className="text-center text-sm text-muted-foreground">
              No shared members found across {scanResults.summary.scannedTrees} connected tree{scanResults.summary.scannedTrees !== 1 ? 's' : ''}.
              <br />
              <span className="text-xs">{scanResults.summary.totalCompared.toLocaleString()} comparisons made.</span>
            </p>
            <Button variant="outline" onClick={() => { setHasScanned(false); setScanResults(null); }} data-testid="button-rescan">
              Scan Again
            </Button>
          </div>
        ) : scanResults ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <GitMerge className="h-4 w-4" />
                <span>
                  <strong>{scanResults.summary.matchesFound}</strong> potential match{scanResults.summary.matchesFound !== 1 ? 'es' : ''} found across{' '}
                  <strong>{scanResults.summary.scannedTrees}</strong> tree{scanResults.summary.scannedTrees !== 1 ? 's' : ''}
                </span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => { setHasScanned(false); setScanResults(null); }} data-testid="button-rescan">
                <Search className="h-3 w-3 mr-1" /> Rescan
              </Button>
            </div>

            <div className="space-y-3">
              {scanResults.matches.map((match, idx) => {
                const requested = match.alreadyRequested || isPairRequested(match.sourceMember.id, match.targetMember.id);
                return (
                  <Card key={idx} className={requested ? "opacity-60" : ""} data-testid={`card-match-${idx}`}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={getScoreColor(match.matchScore)} data-testid={`badge-score-${idx}`}>
                            {getScoreLabel(match.matchScore)} ({match.matchScore}%)
                          </Badge>
                          <Badge variant="secondary" className="text-xs">{match.targetTree.name}</Badge>
                        </div>
                        {requested && (
                          <Badge variant="outline" className="text-xs text-green-600">
                            <CheckCircle className="h-3 w-3 mr-1" /> Requested
                          </Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-start">
                        <div className="space-y-1 p-2 rounded-lg bg-muted/50" data-testid={`panel-source-${idx}`}>
                          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Your Tree</div>
                          <div className="flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="font-medium text-sm">{match.sourceMember.firstName} {match.sourceMember.lastName || ""}</span>
                          </div>
                          {match.sourceMember.birthDate && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              b. {formatDate(match.sourceMember.birthDate)}
                            </div>
                          )}
                          {match.sourceMember.birthPlace && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              <span className="truncate">{match.sourceMember.birthPlace}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center self-center">
                          <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
                        </div>

                        <div className="space-y-1 p-2 rounded-lg bg-primary/5" data-testid={`panel-target-${idx}`}>
                          <div className="text-xs font-medium text-primary uppercase tracking-wide">Connected Tree</div>
                          <div className="flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5 text-primary" />
                            <span className="font-medium text-sm">{match.targetMember.firstName} {match.targetMember.lastName || ""}</span>
                          </div>
                          {match.targetMember.birthDate && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              b. {formatDate(match.targetMember.birthDate)}
                            </div>
                          )}
                          {match.targetMember.birthPlace && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              <span className="truncate">{match.targetMember.birthPlace}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-3">
                        <div className="flex flex-wrap gap-1">
                          {match.matchCriteria.map(c => (
                            <Badge key={c} variant="outline" className="text-xs">{getCriteriaLabel(c)}</Badge>
                          ))}
                        </div>
                        {!requested && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => sendRequestMutation.mutate({
                              requestingMemberId: match.sourceMember.id,
                              targetMemberId: match.targetMember.id,
                              message: `Smart Match found a potential shared member: ${match.sourceMember.firstName} ${match.sourceMember.lastName || ""} (${match.matchScore}% match)`,
                            })}
                            disabled={sendRequestMutation.isPending}
                            data-testid={`button-send-request-${idx}`}
                          >
                            <Send className="h-3 w-3 mr-1" />
                            Send Match Request
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
