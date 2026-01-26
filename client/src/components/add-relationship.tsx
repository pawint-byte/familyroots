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

interface AddRelationshipProps {
  treeId: string;
  currentMember: FamilyMember;
  allMembers: FamilyMember[];
  existingRelationships: Relationship[];
  canEdit: boolean;
}

type RelationshipType = "parent" | "child" | "spouse" | "sibling";
type RelationshipQualifier = "biological" | "step" | "adopted" | "foster" | "half" | "in-law" | "";

const relationshipLabels: Record<RelationshipType, string> = {
  parent: "is a parent of",
  child: "is a child of", 
  spouse: "is a spouse/partner of",
  sibling: "is a sibling of",
};

const qualifierLabels: Record<string, string> = {
  biological: "Biological (default)",
  step: "Step",
  adopted: "Adopted",
  foster: "Foster",
  half: "Half (shares one parent)",
  "in-law": "In-Law",
};

const reverseRelationship: Record<RelationshipType, RelationshipType> = {
  parent: "child",
  child: "parent",
  spouse: "spouse",
  sibling: "sibling",
};

export function AddRelationship({ 
  treeId, 
  currentMember, 
  allMembers, 
  existingRelationships,
  canEdit 
}: AddRelationshipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [relationshipType, setRelationshipType] = useState<RelationshipType | "">("");
  const [qualifier, setQualifier] = useState<RelationshipQualifier>("");
  const { toast } = useToast();

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
        return r.relationshipType === reverseRelationship[relationshipType as RelationshipType];
      }
    })) {
      return false;
    }
    return true;
  });

  const getMemberName = (member: FamilyMember) => {
    return member.lastName ? `${member.firstName} ${member.lastName}` : member.firstName;
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
            <Label>Who is {getMemberName(currentMember)} to the other person?</Label>
            <Select 
              value={relationshipType} 
              onValueChange={(val) => setRelationshipType(val as RelationshipType)}
            >
              <SelectTrigger data-testid="select-relationship-type">
                <SelectValue placeholder="Select relationship type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="parent">
                  {getMemberName(currentMember)} is their <strong>PARENT</strong> (they are {getMemberName(currentMember)}'s child)
                </SelectItem>
                <SelectItem value="child">
                  {getMemberName(currentMember)} is their <strong>CHILD</strong> (they are {getMemberName(currentMember)}'s parent)
                </SelectItem>
                <SelectItem value="spouse">
                  {getMemberName(currentMember)} is their <strong>SPOUSE/PARTNER</strong>
                </SelectItem>
                <SelectItem value="sibling">
                  {getMemberName(currentMember)} is their <strong>SIBLING</strong>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Select what {getMemberName(currentMember)} is to the person you'll select next.
            </p>
          </div>

          {relationshipType && (
            <div className="space-y-2">
              <Label>Relationship Type (optional)</Label>
              <Select 
                value={qualifier} 
                onValueChange={(val) => setQualifier(val as RelationshipQualifier)}
              >
                <SelectTrigger data-testid="select-relationship-qualifier">
                  <SelectValue placeholder="Biological (default)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="biological">{qualifierLabels.biological}</SelectItem>
                  {relationshipType === 'parent' && (
                    <>
                      <SelectItem value="step">{qualifierLabels.step}</SelectItem>
                      <SelectItem value="adopted">{qualifierLabels.adopted}</SelectItem>
                      <SelectItem value="foster">{qualifierLabels.foster}</SelectItem>
                    </>
                  )}
                  {relationshipType === 'child' && (
                    <>
                      <SelectItem value="step">{qualifierLabels.step}</SelectItem>
                      <SelectItem value="adopted">{qualifierLabels.adopted}</SelectItem>
                      <SelectItem value="foster">{qualifierLabels.foster}</SelectItem>
                    </>
                  )}
                  {relationshipType === 'sibling' && (
                    <>
                      <SelectItem value="half">{qualifierLabels.half}</SelectItem>
                      <SelectItem value="step">{qualifierLabels.step}</SelectItem>
                      <SelectItem value="adopted">{qualifierLabels.adopted}</SelectItem>
                    </>
                  )}
                  {relationshipType === 'spouse' && (
                    <SelectItem value="in-law">Former Spouse (In-Law)</SelectItem>
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Specify if this is a step, adopted, half, or other type of relationship.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Select Family Member</Label>
            <Select 
              value={selectedMemberId} 
              onValueChange={setSelectedMemberId}
              disabled={!relationshipType}
            >
              <SelectTrigger data-testid="select-related-member">
                <SelectValue placeholder={relationshipType ? "Select a family member" : "First select a relationship type"} />
              </SelectTrigger>
              <SelectContent>
                {availableMembers.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {getMemberName(member)}
                  </SelectItem>
                ))}
                {availableMembers.length === 0 && relationshipType && (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                    No available members for this relationship type
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>

          {relationshipType && selectedMemberId && (
            <div className="bg-muted p-3 rounded-md text-sm space-y-2">
              <div className="font-medium text-center">
                <strong>{getMemberName(currentMember)}</strong>{" "}
                {relationshipLabels[relationshipType as RelationshipType]}{" "}
                <strong>{getMemberName(allMembers.find(m => m.id === selectedMemberId)!)}</strong>
              </div>
              {relationshipType === "parent" && (
                <p className="text-xs text-muted-foreground text-center">
                  This means {getMemberName(currentMember)} is the parent, 
                  and {getMemberName(allMembers.find(m => m.id === selectedMemberId)!)} is their child.
                </p>
              )}
              {relationshipType === "child" && (
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
