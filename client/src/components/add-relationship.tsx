import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Link2, Loader2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { FamilyMember, Relationship } from "@shared/schema";
import { getTreeTypeConfig, getRelationshipTypesForTree, getReverseRelationshipType, type TreeType, type RelationshipTypeConfig } from "@shared/treeTypes";

type CustomRelType = string | { label: string; reverseLabel?: string };

interface AddRelationshipProps {
  treeId: string;
  treeType?: TreeType;
  customRelationshipTypes?: CustomRelType[] | null;
  currentMember: FamilyMember;
  allMembers: FamilyMember[];
  existingRelationships: Relationship[];
  canEdit: boolean;
  autoOpen?: boolean;
  onAutoOpenHandled?: () => void;
}

type RelationshipQualifier = string;

const CUSTOM_TYPE_SENTINEL = "__custom__";

const familyReverseRelationship: Record<string, string> = {
  parent: "child",
  child: "parent",
  spouse: "spouse",
  sibling: "sibling",
  coparent: "coparent",
  unknown: "unknown",
};

export function AddRelationship({ 
  treeId, 
  treeType = "family",
  customRelationshipTypes,
  currentMember, 
  allMembers, 
  existingRelationships,
  canEdit,
  autoOpen,
  onAutoOpenHandled,
}: AddRelationshipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [relationshipType, setRelationshipType] = useState<string>("");
  const [qualifier, setQualifier] = useState<RelationshipQualifier>("");
  const [isCustomType, setIsCustomType] = useState(false);
  const [customTypeName, setCustomTypeName] = useState("");
  const [customReverseLabel, setCustomReverseLabel] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (autoOpen && !isOpen) {
      setIsOpen(true);
      onAutoOpenHandled?.();
    }
  }, [autoOpen]);
  
  const treeConfig = getTreeTypeConfig(treeType);
  const availableRelTypes = getRelationshipTypesForTree(treeType, customRelationshipTypes);
  const isFamily = treeType === "family";

  const saveCustomTypeMutation = useMutation({
    mutationFn: async (data: { label: string; reverseLabel?: string }) => {
      const existing = customRelationshipTypes || [];
      const alreadyExists = existing.some(t => {
        const label = typeof t === 'string' ? t : t.label;
        return label === data.label;
      });
      if (!alreadyExists) {
        const newEntry: CustomRelType = data.reverseLabel 
          ? { label: data.label, reverseLabel: data.reverseLabel }
          : data.label;
        await apiRequest("PATCH", `/api/trees/${treeId}`, {
          customRelationshipTypes: [...existing, newEntry],
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trees", treeId] });
    },
  });

  const addRelationshipMutation = useMutation({
    mutationFn: async (data: { fromMemberId: string; toMemberId: string; relationshipType: string; qualifier?: string }) => {
      return apiRequest("POST", `/api/trees/${treeId}/relationships`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trees", treeId] });
      setIsOpen(false);
      resetForm();
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

  const resetForm = () => {
    setSelectedMemberId("");
    setRelationshipType("");
    setQualifier("");
    setIsCustomType(false);
    setCustomTypeName("");
    setCustomReverseLabel("");
  };

  const handleSubmit = async () => {
    let finalType = relationshipType;

    if (isCustomType) {
      if (!customTypeName.trim()) return;
      const typeName = customTypeName.trim();
      finalType = typeName.toLowerCase().replace(/\s+/g, '_');
      const reverseLabel = customReverseLabel.trim() || undefined;
      
      try {
        await saveCustomTypeMutation.mutateAsync({ label: typeName, reverseLabel });
      } catch {
        toast({
          title: "Error",
          description: "Failed to save custom relationship type",
          variant: "destructive",
        });
        return;
      }
    }

    if (!selectedMemberId || !finalType) return;

    addRelationshipMutation.mutate({
      fromMemberId: currentMember.id,
      toMemberId: selectedMemberId,
      relationshipType: finalType,
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

  const effectiveRelType = isCustomType ? customTypeName.trim().toLowerCase().replace(/\s+/g, '_') : relationshipType;

  const availableMembers = allMembers.filter((m) => {
    if (m.id === currentMember.id) return false;
    const existing = getExistingRelationshipsWith(m.id);
    if (effectiveRelType && existing.some(r => {
      if (r.fromMemberId === currentMember.id) {
        return r.relationshipType === effectiveRelType;
      } else {
        const reverse = getReverseRelationshipType(treeType, effectiveRelType, customRelationshipTypes);
        return r.relationshipType === (reverse || effectiveRelType);
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

  const handleTypeChange = (val: string) => {
    if (val === CUSTOM_TYPE_SENTINEL) {
      setIsCustomType(true);
      setRelationshipType("");
    } else {
      setIsCustomType(false);
      setCustomTypeName("");
      setCustomReverseLabel("");
      setRelationshipType(val);
    }
  };

  const displayRelType = isCustomType ? customTypeName.trim() : relationshipType;
  const displayRelLabel = isCustomType 
    ? customTypeName.trim() 
    : availableRelTypes.find(r => r.value === relationshipType)?.label || relationshipType;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) resetForm(); }}>
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
            <Label>{`What is ${getMemberName(currentMember)}'s role?`}</Label>
            <Select 
              value={isCustomType ? CUSTOM_TYPE_SENTINEL : relationshipType} 
              onValueChange={handleTypeChange}
            >
              <SelectTrigger data-testid="select-relationship-type">
                <SelectValue placeholder="Select relationship type" />
              </SelectTrigger>
              <SelectContent>
                {availableRelTypes.map((relType) => (
                  <SelectItem key={relType.value} value={relType.value}>
                    {getMemberName(currentMember)} is their <strong>{relType.label.toUpperCase()}</strong>
                    {relType.reverseLabel && ` (they are ${getMemberName(currentMember)}'s ${relType.reverseLabel.toLowerCase()})`}
                  </SelectItem>
                ))}
                <SelectItem value={CUSTOM_TYPE_SENTINEL} data-testid="select-custom-relationship-type">
                  <span className="flex items-center gap-1.5">
                    <Plus className="h-3.5 w-3.5" />
                    Create custom type...
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {isCustomType 
                ? "Type a custom relationship name below. This will be saved and available for future use."
                : `Select what ${getMemberName(currentMember)} is to the person you'll select next.`}
            </p>
          </div>

          {isCustomType && (
            <div className="space-y-3 p-3 border rounded-md bg-muted/50">
              <div className="space-y-2">
                <Label>Custom Relationship Name *</Label>
                <Input
                  placeholder="e.g. Mentor, Coach, Advisor, Captain..."
                  value={customTypeName}
                  onChange={(e) => setCustomTypeName(e.target.value)}
                  data-testid="input-custom-type-name"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  This is {getMemberName(currentMember)}'s role in the relationship.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Other Person's Role (optional)</Label>
                <Input
                  placeholder="e.g. Mentee, Player, Student..."
                  value={customReverseLabel}
                  onChange={(e) => setCustomReverseLabel(e.target.value)}
                  data-testid="input-custom-reverse-label"
                />
                <p className="text-xs text-muted-foreground">
                  What the other person is to {getMemberName(currentMember)}. Leave blank if the relationship is the same both ways.
                </p>
              </div>
            </div>
          )}

          {treeConfig.qualifiersEnabled && treeConfig.qualifiers && treeConfig.qualifiers.length > 0 && (relationshipType || isCustomType) && (
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
              disabled={!effectiveRelType}
            >
              <SelectTrigger data-testid="select-related-member">
                <SelectValue placeholder={effectiveRelType ? `Select a ${treeConfig.memberLabel.toLowerCase()}` : "First select a relationship type"} />
              </SelectTrigger>
              <SelectContent>
                {availableMembers.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {getMemberName(member)}
                  </SelectItem>
                ))}
                {availableMembers.length === 0 && effectiveRelType && (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                    No available {treeConfig.membersLabel.toLowerCase()} for this relationship type
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>

          {displayRelType && selectedMemberId && (
            <div className="bg-muted p-3 rounded-md text-sm space-y-2">
              <div className="font-medium text-center">
                <strong>{getMemberName(currentMember)}</strong>{" "}
                {isFamily 
                  ? `is ${displayRelLabel.toLowerCase()} of`
                  : `is ${displayRelLabel} of`}{" "}
                <strong>{getMemberName(allMembers.find(m => m.id === selectedMemberId)!)}</strong>
              </div>
              {isCustomType && customReverseLabel.trim() && (
                <p className="text-xs text-muted-foreground text-center">
                  {getMemberName(allMembers.find(m => m.id === selectedMemberId)!)} is {getMemberName(currentMember)}'s {customReverseLabel.trim().toLowerCase()}
                </p>
              )}
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
            <Button variant="outline" onClick={() => { setIsOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={
                !selectedMemberId || 
                (!relationshipType && !isCustomType) || 
                (isCustomType && !customTypeName.trim()) ||
                addRelationshipMutation.isPending ||
                saveCustomTypeMutation.isPending
              }
              data-testid="button-confirm-relationship"
            >
              {(addRelationshipMutation.isPending || saveCustomTypeMutation.isPending) ? (
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
