import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle, XCircle, GitMerge, Users, ArrowRight,
  AlertTriangle, User, Calendar, MapPin, Loader2, ArrowLeftRight
} from "lucide-react";

interface ConflictMember {
  id: string;
  firstName: string;
  lastName?: string | null;
  birthDate?: string | null;
  birthPlace?: string | null;
  gender?: string | null;
  photoUrl?: string | null;
}

interface Conflict {
  sourceMember: ConflictMember;
  targetMember: ConflictMember;
  matchScore: number;
  differences: Array<{ field: string; sourceValue: any; targetValue: any }>;
}

interface DetectConflictsResponse {
  conflicts: Conflict[];
  cleanMembers: ConflictMember[];
  summary: {
    totalSourceMembers: number;
    totalTargetMembers: number;
    conflictsFound: number;
    cleanImports: number;
  };
}

type ResolutionAction = "merge" | "keep_both" | "skip";

interface ImportConflictResolutionProps {
  subTreeId: string;
  subTreeName: string;
  parentTreeId: string;
  importedCount: number;
  onComplete: () => void;
  onCancel: () => void;
}

export default function ImportConflictResolution({
  subTreeId,
  subTreeName,
  parentTreeId,
  importedCount,
  onComplete,
  onCancel,
}: ImportConflictResolutionProps) {
  const { toast } = useToast();
  const [resolutions, setResolutions] = useState<Map<string, { action: ResolutionAction; targetMemberId?: string }>>(new Map());

  const { data: conflictData, isLoading } = useQuery<DetectConflictsResponse>({
    queryKey: ["/api/trees", parentTreeId, "detect-conflicts", subTreeId],
    queryFn: async () => {
      const res = await apiRequest("POST", `/api/trees/${parentTreeId}/detect-conflicts`, {
        sourceTreeId: subTreeId,
      });
      return res.json();
    },
  });

  const [importSummary, setImportSummary] = useState<{
    integrity: {
      totalMembers: number;
      totalRelationships: number;
      orphanedRelationships: number;
      maxAncestorDepth: number;
      chainIntact: boolean;
      transferredData: { events: number; nameHistory: number; education: number; career: number; tags: number; fsSources: number; extIds: number; specialConns: number };
      relationshipTypes?: Record<string, number>;
      mergeCount?: number;
      skipCount?: number;
      keepCount?: number;
      rootAncestors?: number;
      leafMembers?: number;
    };
    results: Array<{ sourceMemberId: string; action: string; status: string }>;
  } | null>(null);

  const resolveMutation = useMutation({
    mutationFn: async () => {
      const resolutionArray = Array.from(resolutions.entries()).map(([sourceMemberId, { action, targetMemberId }]) => ({
        sourceMemberId,
        action,
        targetMemberId,
      }));

      const res = await apiRequest("POST", `/api/trees/${parentTreeId}/resolve-conflicts`, {
        sourceTreeId: subTreeId,
        resolutions: resolutionArray,
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.integrity) {
        setImportSummary({ integrity: data.integrity, results: data.results || [] });
        const desc = data.integrity.chainIntact
          ? `All ${data.integrity.totalMembers} members and ${data.integrity.totalRelationships} relationships verified intact. Max ancestor depth: ${data.integrity.maxAncestorDepth} generations.`
          : `Import complete with ${data.integrity.orphanedRelationships} connection warning(s). Please review your tree.`;
        toast({
          title: data.integrity.chainIntact ? "Import Complete — All Connections Verified" : "Import Complete — Review Needed",
          description: desc,
          variant: data.integrity.chainIntact ? "default" : "destructive",
        });
      } else {
        toast({
          title: "Import Complete",
          description: "All imported members and their relationships have been integrated into your tree.",
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/trees"] });
    },
    onError: () => {
      toast({
        title: "Resolution Failed",
        description: "Could not resolve conflicts. Please try again.",
        variant: "destructive",
      });
    },
  });

  const setResolution = (sourceMemberId: string, action: ResolutionAction, targetMemberId?: string) => {
    setResolutions(prev => {
      const next = new Map(prev);
      next.set(sourceMemberId, { action, targetMemberId });
      return next;
    });
  };

  const allConflictsResolved = conflictData?.conflicts.every(c => resolutions.has(c.sourceMember.id)) ?? false;

  const handleConfirm = () => {
    if (conflictData && !allConflictsResolved) {
      toast({
        title: "Unresolved Conflicts",
        description: "Please resolve all potential duplicates before connecting.",
        variant: "destructive",
      });
      return;
    }
    resolveMutation.mutate();
  };

  const formatDate = (date: string | null | undefined) => {
    if (!date) return "Unknown";
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

  if (isLoading) {
    return (
      <div className="space-y-4 p-6" data-testid="conflict-resolution-loading">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!conflictData) return null;

  const { conflicts, cleanMembers, summary } = conflictData;

  return (
    <div className="space-y-6" data-testid="conflict-resolution-container">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold" data-testid="text-resolution-title">Review Import: {subTreeName}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {importedCount} people imported with their relationships. Review potential duplicates below, then confirm to add everyone into your tree. Any members without connections can be linked manually from the tree view.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="border-amber-200 dark:border-amber-800" data-testid="card-conflicts-count">
          <CardContent className="p-4 text-center">
            <AlertTriangle className="h-5 w-5 mx-auto text-amber-500 mb-1" />
            <div className="text-2xl font-bold">{summary.conflictsFound}</div>
            <div className="text-xs text-muted-foreground">Potential Duplicates</div>
          </CardContent>
        </Card>
        <Card data-testid="card-clean-count">
          <CardContent className="p-4 text-center">
            <CheckCircle className="h-5 w-5 mx-auto text-green-500 mb-1" />
            <div className="text-2xl font-bold">{summary.cleanImports}</div>
            <div className="text-xs text-muted-foreground">Clean Imports</div>
          </CardContent>
        </Card>
        <Card data-testid="card-total-count">
          <CardContent className="p-4 text-center">
            <Users className="h-5 w-5 mx-auto text-primary mb-1" />
            <div className="text-2xl font-bold">{summary.totalSourceMembers}</div>
            <div className="text-xs text-muted-foreground">Total Imported</div>
          </CardContent>
        </Card>
      </div>

      {conflicts.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Potential Duplicates ({conflicts.length})
          </h3>
          <p className="text-sm text-muted-foreground">
            These imported members look similar to people already in your tree. Decide how to handle each one:
          </p>
          <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3 space-y-1">
            <p><strong>Same Person</strong> — Merges them into your existing member. All imported relationships (parents, children, spouses) will connect to your existing member. Works great for blended families where the same child might have different parents in each tree.</p>
            <p><strong>Different People</strong> — Keeps both as separate members in your tree. You can manually add relationships to them later from the tree view.</p>
            <p><strong>Skip</strong> — Removes this person from the import entirely.</p>
          </div>

          {conflicts.map((conflict) => {
            const resolution = resolutions.get(conflict.sourceMember.id);
            const { sourceMember, targetMember } = conflict;

            return (
              <Card
                key={sourceMember.id}
                className={`transition-all ${
                  resolution
                    ? resolution.action === "merge"
                      ? "border-green-300 dark:border-green-700 bg-green-50/50 dark:bg-green-950/20"
                      : resolution.action === "keep_both"
                      ? "border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-950/20"
                      : "border-muted bg-muted/30"
                    : "border-amber-200 dark:border-amber-800"
                }`}
                data-testid={`card-conflict-${sourceMember.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <Badge variant="outline" className={getScoreColor(conflict.matchScore)} data-testid={`badge-score-${sourceMember.id}`}>
                      {getScoreLabel(conflict.matchScore)} ({conflict.matchScore}%)
                    </Badge>
                    {resolution && (
                      <Badge
                        variant={resolution.action === "merge" ? "default" : "secondary"}
                        data-testid={`badge-resolution-${sourceMember.id}`}
                      >
                        {resolution.action === "merge" ? "Will Merge" : resolution.action === "keep_both" ? "Keep Both" : "Will Skip"}
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-start">
                    <div className="space-y-2 p-3 rounded-lg bg-muted/50" data-testid={`panel-imported-${sourceMember.id}`}>
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Imported</div>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{sourceMember.firstName} {sourceMember.lastName || ""}</span>
                      </div>
                      {sourceMember.birthDate && (
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          <span>b. {formatDate(sourceMember.birthDate)}</span>
                        </div>
                      )}
                      {sourceMember.birthPlace && (
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          <span className="truncate">{sourceMember.birthPlace}</span>
                        </div>
                      )}
                      {sourceMember.gender && (
                        <div className="text-sm text-muted-foreground capitalize">{sourceMember.gender}</div>
                      )}
                    </div>

                    <div className="flex items-center self-center">
                      <ArrowLeftRight className="h-5 w-5 text-muted-foreground" />
                    </div>

                    <div className="space-y-2 p-3 rounded-lg bg-primary/5" data-testid={`panel-existing-${sourceMember.id}`}>
                      <div className="text-xs font-medium text-primary uppercase tracking-wide">In Your Tree</div>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-primary" />
                        <span className="font-medium">{targetMember.firstName} {targetMember.lastName || ""}</span>
                      </div>
                      {targetMember.birthDate && (
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          <span>b. {formatDate(targetMember.birthDate)}</span>
                        </div>
                      )}
                      {targetMember.birthPlace && (
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          <span className="truncate">{targetMember.birthPlace}</span>
                        </div>
                      )}
                      {targetMember.gender && (
                        <div className="text-sm text-muted-foreground capitalize">{targetMember.gender}</div>
                      )}
                    </div>
                  </div>

                  {conflict.differences.length > 0 && (
                    <div className="mt-3 p-2 rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                      <div className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1">Differences:</div>
                      <div className="flex flex-wrap gap-2">
                        {conflict.differences.map((diff) => (
                          <Badge key={diff.field} variant="outline" className="text-xs">
                            {diff.field}: "{diff.sourceValue || "—"}" vs "{diff.targetValue || "—"}"
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 mt-3">
                    <Button
                      size="sm"
                      variant={resolution?.action === "merge" ? "default" : "outline"}
                      onClick={() => setResolution(sourceMember.id, "merge", targetMember.id)}
                      className="flex-1"
                      data-testid={`button-merge-${sourceMember.id}`}
                    >
                      <GitMerge className="h-3 w-3 mr-1" />
                      Same Person
                    </Button>
                    <Button
                      size="sm"
                      variant={resolution?.action === "keep_both" ? "default" : "outline"}
                      onClick={() => setResolution(sourceMember.id, "keep_both")}
                      className="flex-1"
                      data-testid={`button-keep-both-${sourceMember.id}`}
                    >
                      <Users className="h-3 w-3 mr-1" />
                      Different People
                    </Button>
                    <Button
                      size="sm"
                      variant={resolution?.action === "skip" ? "destructive" : "outline"}
                      onClick={() => setResolution(sourceMember.id, "skip", targetMember.id)}
                      data-testid={`button-skip-${sourceMember.id}`}
                    >
                      <XCircle className="h-3 w-3 mr-1" />
                      Skip
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {cleanMembers.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            New Members ({cleanMembers.length})
          </h3>
          <p className="text-sm text-muted-foreground">
            These people don't match anyone in your existing tree and will be added as new members.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {cleanMembers.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 text-sm"
                data-testid={`card-clean-member-${member.id}`}
              >
                <User className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="truncate">{member.firstName} {member.lastName || ""}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {conflicts.length === 0 && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            No duplicates found. All {cleanMembers.length} imported members are unique and will be added to your tree with their relationships intact. Click below to confirm.
          </AlertDescription>
        </Alert>
      )}

      {importSummary && (
        <Card className="border-green-500/30 bg-green-50/5" data-testid="card-import-summary">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              {importSummary.integrity.chainIntact ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
              )}
              Import Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span><strong>{importSummary.integrity.totalMembers}</strong> total members</span>
              </div>
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
                <span><strong>{importSummary.integrity.totalRelationships}</strong> total connections</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {importSummary.results.filter(r => r.status === "merged").length > 0 && (
                <Badge variant="outline" className="text-xs">
                  <GitMerge className="h-3 w-3 mr-1" />
                  {importSummary.results.filter(r => r.status === "merged").length} merged
                </Badge>
              )}
              {importSummary.results.filter(r => r.status === "kept").length > 0 && (
                <Badge variant="outline" className="text-xs">
                  <Users className="h-3 w-3 mr-1" />
                  {importSummary.results.filter(r => r.status === "kept").length} kept separate
                </Badge>
              )}
              {importSummary.results.filter(r => r.status === "removed").length > 0 && (
                <Badge variant="outline" className="text-xs">
                  <XCircle className="h-3 w-3 mr-1" />
                  {importSummary.results.filter(r => r.status === "removed").length} skipped
                </Badge>
              )}
            </div>
            <div className="pt-2 border-t">
              <p className="font-medium flex items-center gap-1.5">
                {importSummary.integrity.chainIntact ? (
                  <><CheckCircle className="h-4 w-4 text-green-500" /> All ancestor connections verified intact</>
                ) : (
                  <><AlertTriangle className="h-4 w-4 text-yellow-500" /> {importSummary.integrity.orphanedRelationships} connection(s) may need review</>
                )}
              </p>
              <p className="text-muted-foreground mt-1">
                Deepest ancestor chain: {importSummary.integrity.maxAncestorDepth} generation{importSummary.integrity.maxAncestorDepth !== 1 ? 's' : ''}
              </p>
              {(importSummary.integrity.rootAncestors ?? 0) > 0 && (
                <p className="text-muted-foreground mt-1">
                  {importSummary.integrity.rootAncestors} root ancestor{importSummary.integrity.rootAncestors !== 1 ? 's' : ''}, {importSummary.integrity.leafMembers ?? 0} leaf member{(importSummary.integrity.leafMembers ?? 0) !== 1 ? 's' : ''}
                </p>
              )}
              {importSummary.integrity.relationshipTypes && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {Object.entries(importSummary.integrity.relationshipTypes).map(([type, count]) => (
                    <Badge key={type} variant="outline" className="text-xs">
                      {count} {type}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            {Object.values(importSummary.integrity.transferredData).some(v => v > 0) && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground mb-1">Data preserved during merge:</p>
                <div className="flex flex-wrap gap-1.5">
                  {importSummary.integrity.transferredData.events > 0 && <Badge variant="secondary" className="text-xs">{importSummary.integrity.transferredData.events} events</Badge>}
                  {importSummary.integrity.transferredData.nameHistory > 0 && <Badge variant="secondary" className="text-xs">{importSummary.integrity.transferredData.nameHistory} name records</Badge>}
                  {importSummary.integrity.transferredData.education > 0 && <Badge variant="secondary" className="text-xs">{importSummary.integrity.transferredData.education} education</Badge>}
                  {importSummary.integrity.transferredData.career > 0 && <Badge variant="secondary" className="text-xs">{importSummary.integrity.transferredData.career} career</Badge>}
                  {importSummary.integrity.transferredData.tags > 0 && <Badge variant="secondary" className="text-xs">{importSummary.integrity.transferredData.tags} tags</Badge>}
                  {importSummary.integrity.transferredData.fsSources > 0 && <Badge variant="secondary" className="text-xs">{importSummary.integrity.transferredData.fsSources} sources</Badge>}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between pt-4 border-t">
        {importSummary ? (
          <div className="w-full flex justify-end">
            <Button onClick={onComplete} data-testid="button-done-import">
              <CheckCircle className="h-4 w-4 mr-2" />
              Done — View Tree
            </Button>
          </div>
        ) : (
          <>
            <Button variant="ghost" onClick={onCancel} data-testid="button-cancel-resolution">
              Cancel
            </Button>
            <div className="flex items-center gap-3">
              {conflicts.length > 0 && !allConflictsResolved && (
                <span className="text-sm text-muted-foreground">
                  {resolutions.size}/{conflicts.length} resolved
                </span>
              )}
              <Button
                onClick={handleConfirm}
                disabled={resolveMutation.isPending || (conflicts.length > 0 && !allConflictsResolved)}
                data-testid="button-confirm-connect"
              >
                {resolveMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <ArrowRight className="h-4 w-4 mr-2" />
                    {conflicts.length === 0 ? "Connect Import" : "Resolve & Connect"}
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
