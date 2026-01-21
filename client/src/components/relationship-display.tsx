import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, GitBranch, X, ArrowRight, Target } from "lucide-react";
import type { FamilyMember } from "@shared/schema";

interface RelationshipResult {
  relationshipName: string;
  path: string[];
  pathWithNames: Array<{ id: string; name: string }>;
  commonAncestors: string[];
  generationsFromA: number;
  generationsFromB: number;
  isDirectLine: boolean;
}

interface RelationshipDisplayProps {
  treeId: string;
  focusMember: FamilyMember | null;
  selectedMember: FamilyMember | null;
  onClearFocus?: () => void;
  onViewPath?: () => void;
}

export function RelationshipDisplay({
  treeId,
  focusMember,
  selectedMember,
  onClearFocus,
  onViewPath,
}: RelationshipDisplayProps) {
  const { data: relationshipData, isLoading } = useQuery<RelationshipResult>({
    queryKey: ['/api/trees', treeId, 'relationship', focusMember?.id, selectedMember?.id],
    queryFn: async () => {
      if (!focusMember || !selectedMember || focusMember.id === selectedMember.id) {
        return null;
      }
      const response = await fetch(
        `/api/trees/${treeId}/relationship?fromMemberId=${focusMember.id}&toMemberId=${selectedMember.id}`
      );
      if (!response.ok) throw new Error("Failed to fetch relationship");
      return response.json();
    },
    enabled: !!focusMember && !!selectedMember && focusMember.id !== selectedMember.id,
  });

  if (!focusMember) {
    return null;
  }

  const isSamePerson = focusMember && selectedMember && focusMember.id === selectedMember.id;

  return (
    <Card className="mb-4" data-testid="relationship-display">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            Viewing from {focusMember.firstName}'s perspective
          </CardTitle>
          {onClearFocus && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClearFocus}
              className="h-6 w-6"
              data-testid="button-clear-focus"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!selectedMember ? (
          <p className="text-sm text-muted-foreground">
            Click on a family member to see how they're related to {focusMember.firstName}
          </p>
        ) : isSamePerson ? (
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Self</Badge>
            <span className="text-sm text-muted-foreground">
              This is {focusMember.firstName}
            </span>
          </div>
        ) : isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
        ) : relationshipData ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium">{selectedMember.firstName} is</span>
              <Badge 
                variant={relationshipData.isDirectLine ? "default" : "secondary"}
                className="text-sm"
                data-testid="badge-relationship"
              >
                {focusMember.firstName}'s {relationshipData.relationshipName}
              </Badge>
            </div>

            {relationshipData.pathWithNames && relationshipData.pathWithNames.length > 2 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <GitBranch className="h-3 w-3" />
                  <span>Connection path:</span>
                </div>
                <div className="flex items-center gap-1 flex-wrap text-xs">
                  {relationshipData.pathWithNames.map((person, index) => (
                    <span key={person.id} className="flex items-center gap-1">
                      <span 
                        className={`${
                          index === 0 || index === relationshipData.pathWithNames.length - 1
                            ? "font-medium text-foreground"
                            : "text-muted-foreground"
                        }`}
                      >
                        {person.name}
                      </span>
                      {index < relationshipData.pathWithNames.length - 1 && (
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {relationshipData.commonAncestors && relationshipData.commonAncestors.length > 0 && 
             !relationshipData.isDirectLine && (
              <div className="text-xs text-muted-foreground">
                <Users className="h-3 w-3 inline mr-1" />
                {relationshipData.commonAncestors.length} common ancestor{relationshipData.commonAncestors.length > 1 ? 's' : ''}
              </div>
            )}

            {onViewPath && relationshipData.path.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={onViewPath}
                className="w-full mt-2"
                data-testid="button-view-path"
              >
                <GitBranch className="h-4 w-4 mr-2" />
                View Family Path
              </Button>
            )}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            <span>{selectedMember.firstName} and {focusMember.firstName} are not directly related</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface FocusMemberSelectorProps {
  members: FamilyMember[];
  focusMember: FamilyMember | null;
  onSelectFocus: (member: FamilyMember | null) => void;
}

export function FocusMemberSelector({
  members,
  focusMember,
  onSelectFocus,
}: FocusMemberSelectorProps) {
  if (members.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 mb-4" data-testid="focus-member-selector">
      <Target className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm text-muted-foreground">Focus person:</span>
      <select
        className="text-sm border rounded px-2 py-1 bg-background"
        value={focusMember?.id || ""}
        onChange={(e) => {
          const member = members.find((m) => m.id === e.target.value);
          onSelectFocus(member || null);
        }}
        data-testid="select-focus-member"
      >
        <option value="">None (click to select)</option>
        {members.map((member) => (
          <option key={member.id} value={member.id}>
            {member.firstName} {member.lastName}
          </option>
        ))}
      </select>
      {focusMember && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onSelectFocus(null)}
          data-testid="button-clear-focus-selector"
        >
          Clear
        </Button>
      )}
    </div>
  );
}
