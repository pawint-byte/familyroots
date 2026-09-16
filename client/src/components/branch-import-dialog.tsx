import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { getSignupAttributionPayload } from "@/lib/attribution";
import { Users, User, ArrowRight, DollarSign, Check, AlertCircle, Search, UserPlus } from "lucide-react";

interface AvailableMember {
  id: string;
  firstName: string;
  lastName: string | null;
  photoUrl: string | null;
  gender: string | null;
  birthDate: string | null;
  isLiving: boolean | null;
  alreadyImported: boolean;
  relationshipBadges: string[];
  immediateRelativeIds: string[];
}

interface SourceRelationship {
  id: string;
  fromMemberId: string;
  toMemberId: string;
  relationshipType: string;
  qualifier: string | null;
}

interface AvailableMembersData {
  sourceTree: { id: string; name: string };
  members: AvailableMember[];
  relationships: SourceRelationship[];
  connectorMemberIds: {
    sourceMemberId: string | null;
    targetMemberId: string | null;
  };
  currentTotal: number;
  currentTier: { price: number; label: string };
}

export interface ImportPreviewData {
  selectedMembers: AvailableMember[];
  relationships: SourceRelationship[];
  connectorMemberIds: {
    sourceMemberId: string | null;
    targetMemberId: string | null;
  };
}

interface BranchImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  treeId: string;
  connectionId: string;
  connectorMemberId?: string;
  sourceTreeName?: string;
  onSelectionChange?: (selectedIds: string[]) => void;
  onPreviewChange?: (previewData: ImportPreviewData | null) => void;
}

export function BranchImportDialog({
  isOpen,
  onClose,
  treeId,
  connectionId,
  connectorMemberId,
  sourceTreeName,
  onSelectionChange,
  onPreviewChange
}: BranchImportDialogProps) {
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  const { data: availableData, isLoading } = useQuery<AvailableMembersData>({
    queryKey: ["/api/trees", treeId, "connections", connectionId, "available-members"],
    queryFn: async () => {
      const response = await fetch(
        `/api/trees/${treeId}/connections/${connectionId}/available-members`,
        { credentials: "include" }
      );
      if (!response.ok) throw new Error("Failed to fetch available members");
      return response.json();
    },
    enabled: isOpen
  });

  const importableMemberIds = useMemo(() => {
    if (!availableData) return new Set<string>();
    return new Set(availableData.members.filter(m => !m.alreadyImported).map(m => m.id));
  }, [availableData]);

  const highlightedIds = useMemo(() => {
    if (!availableData) return new Set<string>();
    const highlighted = new Set<string>();
    const selectedArr = Array.from(selectedIds);
    for (let i = 0; i < selectedArr.length; i++) {
      const member = availableData.members.find(m => m.id === selectedArr[i]);
      if (member) {
        for (let j = 0; j < member.immediateRelativeIds.length; j++) {
          const relId = member.immediateRelativeIds[j];
          if (!selectedIds.has(relId) && importableMemberIds.has(relId)) {
            highlighted.add(relId);
          }
        }
      }
    }
    return highlighted;
  }, [selectedIds, availableData, importableMemberIds]);

  useEffect(() => {
    if (!onPreviewChange || !availableData) return;
    if (selectedIds.size === 0) {
      onPreviewChange(null);
      return;
    }
    const selectedMembers = availableData.members.filter(m => selectedIds.has(m.id));
    const selectedIdSet = selectedIds;
    const relevantRels = availableData.relationships.filter(r =>
      selectedIdSet.has(r.fromMemberId) || selectedIdSet.has(r.toMemberId)
    );
    onPreviewChange({
      selectedMembers,
      relationships: relevantRels,
      connectorMemberIds: availableData.connectorMemberIds,
    });
  }, [selectedIds, availableData, onPreviewChange]);

  const filteredMembers = useMemo(() => {
    if (!availableData) return [];
    const query = searchQuery.toLowerCase().trim();
    if (!query) return availableData.members;
    return availableData.members.filter(m => {
      const fullName = `${m.firstName} ${m.lastName || ""}`.toLowerCase();
      return fullName.includes(query);
    });
  }, [availableData, searchQuery]);

  const toggleMember = (memberId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(memberId)) {
        next.delete(memberId);
      } else {
        next.add(memberId);
      }
      onSelectionChange?.(Array.from(next));
      return next;
    });
  };

  const selectAll = () => {
    const allImportable = filteredMembers.filter(m => !m.alreadyImported).map(m => m.id);
    setSelectedIds(prev => {
      const next = new Set(prev);
      allImportable.forEach(id => next.add(id));
      onSelectionChange?.(Array.from(next));
      return next;
    });
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
    onSelectionChange?.([]);
  };

  const getPricingTier = (count: number) => {
    if (count >= 100) return { price: 0, label: "FREE" };
    if (count >= 75) return { price: 2.50, label: "75% off" };
    if (count >= 50) return { price: 4.99, label: "50% off" };
    if (count >= 25) return { price: 7.49, label: "25% off" };
    return { price: 9.99, label: "Base" };
  };

  const currentTotal = availableData?.currentTotal || 0;
  const newTotal = currentTotal + selectedIds.size;
  const currentTier = availableData?.currentTier || getPricingTier(currentTotal);
  const newTier = getPricingTier(newTotal);
  const tierChange = currentTier.price !== newTier.price;

  const importMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/trees/${treeId}/connections/${connectionId}/import`, {
        memberIds: Array.from(selectedIds),
        ...getSignupAttributionPayload(),
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Members imported successfully",
        description: `Imported ${data.importedCount} family members`
      });
      queryClient.invalidateQueries({ queryKey: ["/api/trees", treeId] });
      setSelectedIds(new Set());
      onSelectionChange?.([]);
      onClose();
    },
    onError: () => {
      toast({
        title: "Import failed",
        description: "Could not import the selected members",
        variant: "destructive"
      });
    }
  });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        setSelectedIds(new Set());
        setSearchQuery("");
        onSelectionChange?.([]);
        onPreviewChange?.(null);
        onClose();
      }
    }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" data-testid="dialog-branch-import">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Import Members from {sourceTreeName || "Connected Tree"}
          </DialogTitle>
          <DialogDescription>
            Select specific family members to import. Imported members count toward your subscription.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4 py-2">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          ) : availableData ? (
            <>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search members..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                    data-testid="input-search-members"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={selectAll} data-testid="button-select-all">
                  Select All
                </Button>
                <Button variant="outline" size="sm" onClick={deselectAll} data-testid="button-deselect-all">
                  Clear
                </Button>
              </div>

              <Card>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                        <Users className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{selectedIds.size} selected</p>
                        <p className="text-xs text-muted-foreground">
                          {currentTotal} current + {selectedIds.size} new = {newTotal} total
                        </p>
                      </div>
                    </div>
                    {tierChange ? (
                      <Badge variant="secondary" className="gap-1">
                        <DollarSign className="h-3 w-3" />
                        {currentTier.label} <ArrowRight className="h-3 w-3" /> {newTier.label}
                      </Badge>
                    ) : selectedIds.size > 0 ? (
                      <Badge variant="outline" className="gap-1">
                        <Check className="h-3 w-3" />
                        No tier change
                      </Badge>
                    ) : null}
                  </div>
                </CardContent>
              </Card>

              <ScrollArea className="flex-1 min-h-0 rounded-lg border">
                <div className="p-2 space-y-1">
                  {filteredMembers.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No members found</p>
                    </div>
                  ) : (
                    filteredMembers.map((member) => {
                      const isSelected = selectedIds.has(member.id);
                      const isHighlighted = highlightedIds.has(member.id);
                      const isDisabled = member.alreadyImported;

                      return (
                        <div
                          key={member.id}
                          className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                            isDisabled ? "opacity-50 cursor-not-allowed" :
                            isSelected ? "bg-primary/10" :
                            isHighlighted ? "bg-accent/50 border border-dashed border-primary/30" :
                            "hover-elevate"
                          }`}
                          onClick={() => !isDisabled && toggleMember(member.id)}
                          data-testid={`member-row-${member.id}`}
                        >
                          <Checkbox
                            checked={isSelected}
                            disabled={isDisabled}
                            onCheckedChange={() => !isDisabled && toggleMember(member.id)}
                            data-testid={`checkbox-member-${member.id}`}
                          />
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={member.photoUrl || undefined} />
                            <AvatarFallback>
                              <User className="h-4 w-4" />
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium truncate">
                                {member.firstName} {member.lastName || ""}
                              </span>
                              {member.alreadyImported && (
                                <Badge variant="outline" className="text-xs">
                                  Already imported
                                </Badge>
                              )}
                              {isHighlighted && !isSelected && (
                                <Badge variant="secondary" className="text-xs">
                                  Related
                                </Badge>
                              )}
                            </div>
                            {member.relationshipBadges.length > 0 && (
                              <p className="text-xs text-muted-foreground truncate">
                                {member.relationshipBadges.join(" · ")}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>

              {newTotal >= 100 && currentTotal < 100 && selectedIds.size > 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    This import will bring you to 100+ members, making your subscription FREE!
                  </AlertDescription>
                </Alert>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Unable to load members from connected tree</p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => {
            setSelectedIds(new Set());
            setSearchQuery("");
            onSelectionChange?.([]);
            onClose();
          }} data-testid="button-cancel-import">
            Cancel
          </Button>
          <Button
            onClick={() => importMutation.mutate()}
            disabled={selectedIds.size === 0 || importMutation.isPending}
            data-testid="button-confirm-import"
          >
            {importMutation.isPending ? "Importing..." : `Import ${selectedIds.size} Members`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
