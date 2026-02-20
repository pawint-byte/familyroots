import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Link2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { FamilyMember, Relationship } from "@shared/schema";
import { getTreeTypeConfig, getRelationshipTypesForTree, getReverseRelationshipType, type TreeType, type RelationshipTypeConfig } from "@shared/treeTypes";

interface AddRelationshipProps {
  treeId: string;
  treeType?: TreeType;
  customRelationshipTypes?: string[] | null;
  currentMember: FamilyMember;
  allMembers: FamilyMember[];
  existingRelationships: Relationship[];
  canEdit: boolean;
}

type RelationshipQualifier = string;

const familyReverseRelationship: Record<string, string> = {
  parent: "child",
  child: "parent",
  spouse: "spouse",
  sibling: "sibling",
  coparent: "coparent",
};

export function AddRelationship({ 
  treeId, 
  treeType = "family",
  customRelationshipTypes,
  currentMember, 
  allMembers, 
  existingRelationships,
  canEdit 
}: AddRelationshipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [relationshipType, setRelationshipType] = useState<string>("");
  const [qualifier, setQualifier] = useState<RelationshipQualifier>("");
  const { toast } = useToast();
  
  const treeConfig = getTreeTypeConfig(treeType);
  const availableRelTypes = getRelationshipTypesForTree(treeType, customRelationshipTypes);
  const isFamily = treeType === "family";

  const addRelationshipMutation = useMutation({
    mutationFn: async (data: { fromMemberId: string; toMemberId: string; relationshipType: string; qualifier?: string }) => {
      return apiRequest("POST", `/api/trees/${treeId}/relationships`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trees", treeId] });
      setIsOpen(false);
      setSelectedMemberId("");
      setRelationshipType("");
      setQualifier("");
      toast({
        title: "Success",
        description: "Relationship added successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add relationship",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!selectedMemberId || !relationshipType) return;

    addRelationshipMutation.mutate({
      fromMemberId: currentMember.id,
      toMemberId: selectedMemberId,
      relationshipType: relationshipType,
      // Only include qualifier if it's set and not biological (biological is the default/null)
      ...(qualifier && qualifier !== 'biological' ? { qualifier } : {}),
    });
  };

  const getExistingRelationshipsWith = (memberId: string): Relationship[] => {
    return existingRelationships.filter(
      (r) =>
        (r.fromMemberId === currentMember.id && r.toMemberId === memberId) ||
        (r.fromMemberId === memberId && r.toMemberId === currentMember.id)
    );
  };

  const availableMembers = allMembers.filter((m) => {
    if (m.id === currentMember.id) return false;
    const existing = getExistingRelationshipsWith(m.id);
    if (relationshipType && existing.some(r => {
      if (r.fromMemberId === currentMember.id) {
        return r.relationshipType === relationshipType;
      } else {
        const reverse = getReverseRelationshipType(treeType, relationshipType, customRelationshipTypes);
        return r.relationshipType === (reverse || relationshipType);
      }
    })) {
      return false;
    }
    return true;
  });

  const getMemberName = (member: FamilyMember) => {
    const baseName = member.lastName ? `${member.firstName} ${member.lastName}` : member.firstName;
    return member.suffix ? `${baseName} ${member.suffix}` : baseName;
  };

  if (!canEdit) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2" data-testid="button-add-relationship">
          <Link2 className="h-4 w-4" />
          Add Relationship
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Relationship for {getMemberName(currentMember)}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label>{isFamily ? `Who is ${getMemberName(currentMember)} to the other person?` : "Select role/relationship"}</Label>
            <Select 
              value={relationshipType} 
              onValueChange={(val) => setRelationshipType(val)}
            >
              <SelectTrigger data-testid="select-relationship-type">
                <SelectValue placeholder="Select relationship type" />
              </SelectTrigger>
              <SelectContent>
                {availableRelTypes.map((relType) => (
                  <SelectItem key={relType.value} value={relType.value}>
                    {isFamily ? (
                      <>
                        {getMemberName(currentMember)} is their <strong>{relType.label.toUpperCase()}</strong>
                        {relType.reverseLabel && ` (they are ${getMemberName(currentMember)}'s ${relType.reverseLabel.toLowerCase()})`}
                      </>
                    ) : (
                      <>
                        <strong>{relType.label}</strong>
                        {relType.description && ` - ${relType.description}`}
                      </>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {isFamily 
                ? `Select what ${getMemberName(currentMember)} is to the person you'll select next.`
                : `Select the role of ${getMemberName(currentMember)} relative to the other ${treeConfig.memberLabel.toLowerCase()}.`}
            </p>
          </div>

          {treeConfig.qualifiersEnabled && treeConfig.qualifiers && treeConfig.qualifiers.length > 0 && relationshipType && (
            <div className="space-y-2">
              <Label>{treeConfig.qualifierLabel || "Qualifier"} (optional)</Label>
              <Select 
                value={qualifier} 
                onValueChange={(val) => setQualifier(val as RelationshipQualifier)}
              >
                <SelectTrigger data-testid="select-relationship-qualifier">
                  <SelectValue placeholder={treeConfig.qualifierPlaceholder || "Select..."} />
                </SelectTrigger>
                <SelectContent>
                  {(treeConfig.qualifiers || []).map((q) => {
                    if (isFamily) {
                      if (relationshipType === 'spouse' && !['biological', 'in-law'].includes(q.value)) return null;
                      if (relationshipType === 'sibling' && !['biological', 'half', 'step', 'adopted'].includes(q.value)) return null;
                      if (['parent', 'child'].includes(relationshipType) && !['biological', 'step', 'adopted', 'foster'].includes(q.value)) return null;
                      if (relationshipType === 'coparent' && q.value !== 'biological') return null;
                    }
                    return (
                      <SelectItem key={q.value} value={q.value}>{q.label}</SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {isFamily 
                  ? "Specify if this is a step, adopted, half, or other type of relationship."
                  : `Add extra detail to this ${treeConfig.memberLabel.toLowerCase()}'s role.`}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Select {treeConfig.memberLabel}</Label>
            <Select 
              value={selectedMemberId} 
              onValueChange={setSelectedMemberId}
              disabled={!relationshipType}
            >
              <SelectTrigger data-testid="select-related-member">
                <SelectValue placeholder={relationshipType ? `Select a ${treeConfig.memberLabel.toLowerCase()}` : "First select a relationship type"} />
              </SelectTrigger>
              <SelectContent>
                {availableMembers.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {getMemberName(member)}
                  </SelectItem>
                ))}
                {availableMembers.length === 0 && relationshipType && (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                    No available {treeConfig.membersLabel.toLowerCase()} for this relationship type
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>

          {relationshipType && selectedMemberId && (
            <div className="bg-muted p-3 rounded-md text-sm space-y-2">
              <div className="font-medium text-center">
                <strong>{getMemberName(currentMember)}</strong>{" "}
                {(() => {
                  const relConfig = availableRelTypes.find(r => r.value === relationshipType);
                  return isFamily 
                    ? `is ${relConfig?.label.toLowerCase()} of`
                    : `is ${relConfig?.label || relationshipType} of`;
                })()}{" "}
                <strong>{getMemberName(allMembers.find(m => m.id === selectedMemberId)!)}</strong>
              </div>
              {isFamily && relationshipType === "parent" && (
                <p className="text-xs text-muted-foreground text-center">
                  This means {getMemberName(currentMember)} is the parent, 
                  and {getMemberName(allMembers.find(m => m.id === selectedMemberId)!)} is their child.
                </p>
              )}
              {isFamily && relationshipType === "child" && (
                <p className="text-xs text-muted-foreground text-center">
                  This means {getMemberName(currentMember)} is the child, 
                  and {getMemberName(allMembers.find(m => m.id === selectedMemberId)!)} is their parent.
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={!selectedMemberId || !relationshipType || addRelationshipMutation.isPending}
              data-testid="button-confirm-relationship"
            >
              {addRelationshipMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Relationship"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
