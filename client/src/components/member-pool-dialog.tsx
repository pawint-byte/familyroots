import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Users, User, Search, UserPlus, TreeDeciduous, MapPin, Check } from "lucide-react";

interface PoolMember {
  id: string;
  firstName: string;
  lastName: string | null;
  photoUrl: string | null;
  gender: string | null;
  birthDate: string | null;
  deathDate: string | null;
  birthPlace: string | null;
  isLiving: boolean | null;
  sourceTreeId: string;
  sourceTreeName: string;
  alreadyInTree: boolean;
  relationships: Array<{
    type: string;
    qualifier: string | null;
    otherMemberName: string;
  }>;
}

interface MemberPoolData {
  members: PoolMember[];
  totalAvailable: number;
}

interface MemberPoolDialogProps {
  isOpen: boolean;
  onClose: () => void;
  treeId: string;
}

export function MemberPoolDialog({ isOpen, onClose, treeId }: MemberPoolDialogProps) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<Map<string, PoolMember>>(new Map());
  const [searchTimeout, setSearchTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (searchTimeout) clearTimeout(searchTimeout);
    const timeout = setTimeout(() => setDebouncedSearch(value), 300);
    setSearchTimeout(timeout);
  };

  const { data: poolData, isLoading } = useQuery<MemberPoolData>({
    queryKey: ["/api/trees", treeId, "member-pool", debouncedSearch],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      const response = await fetch(
        `/api/trees/${treeId}/member-pool?${params.toString()}`,
        { credentials: "include" }
      );
      if (!response.ok) throw new Error("Failed to fetch member pool");
      return response.json();
    },
    enabled: isOpen,
  });

  const toggleMember = (member: PoolMember) => {
    setSelectedMembers(prev => {
      const next = new Map(prev);
      const key = `${member.id}_${member.sourceTreeId}`;
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.set(key, member);
      }
      return next;
    });
  };

  const groupedByTree = useMemo(() => {
    const selected = Array.from(selectedMembers.values());
    const groups = new Map<string, { treeName: string; members: PoolMember[] }>();
    for (const m of selected) {
      if (!groups.has(m.sourceTreeId)) {
        groups.set(m.sourceTreeId, { treeName: m.sourceTreeName, members: [] });
      }
      groups.get(m.sourceTreeId)!.members.push(m);
    }
    return groups;
  }, [selectedMembers]);

  const importMutation = useMutation({
    mutationFn: async () => {
      const results: any[] = [];
      for (const [sourceTreeId, group] of groupedByTree) {
        const memberIds = group.members.map(m => m.id);
        const result = await apiRequest("POST", `/api/trees/${treeId}/member-pool/import`, {
          sourceMemberIds: memberIds,
          sourceTreeId,
        });
        results.push(result);
      }
      return results;
    },
    onSuccess: (results: any[]) => {
      const totalImported = results.reduce((sum, r) => sum + (r.importedCount || 0), 0);
      const totalRels = results.reduce((sum, r) => sum + (r.relationshipsCreated || 0), 0);
      toast({
        title: "Members added to tree",
        description: `Added ${totalImported} member${totalImported > 1 ? 's' : ''}${totalRels > 0 ? ` with ${totalRels} relationship${totalRels > 1 ? 's' : ''}` : ''}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/trees", treeId] });
      setSelectedMembers(new Map());
      onClose();
    },
    onError: () => {
      toast({
        title: "Import failed",
        description: "Could not import the selected members",
        variant: "destructive",
      });
    },
  });

  const formatDateRange = (birth: string | null, death: string | null) => {
    const b = birth ? new Date(birth).getFullYear() : null;
    const d = death ? new Date(death).getFullYear() : null;
    if (b && d) return `${b} – ${d}`;
    if (b) return `b. ${b}`;
    return null;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        setSelectedMembers(new Map());
        setSearchQuery("");
        setDebouncedSearch("");
        onClose();
      }
    }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" data-testid="dialog-member-pool">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Add from Family Network
          </DialogTitle>
          <DialogDescription>
            Search for members already in your other trees or your connections' trees. Add them here without re-entering their information.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-3 py-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9"
              data-testid="input-search-member-pool"
              autoFocus
            />
          </div>

          {selectedMembers.size > 0 && (
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserPlus className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">{selectedMembers.size} selected</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedMembers(new Map())} data-testid="button-clear-pool-selection">
                    Clear
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <ScrollArea className="flex-1 min-h-0 rounded-lg border">
            <div className="p-2 space-y-1">
              {isLoading ? (
                <div className="space-y-3 p-2">
                  {[1, 2, 3, 4, 5].map(i => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : !debouncedSearch && !poolData ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Search className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm font-medium">Search your family network</p>
                  <p className="text-xs mt-1">Type a name to find members from your other trees and connections</p>
                </div>
              ) : poolData && poolData.members.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No members found for "{debouncedSearch}"</p>
                </div>
              ) : poolData ? (
                <>
                  {poolData.totalAvailable > 200 && (
                    <p className="text-xs text-muted-foreground px-2 pb-1">
                      Showing 200 of {poolData.totalAvailable} — refine your search for more
                    </p>
                  )}
                  {poolData.members.map((member) => {
                    const key = `${member.id}_${member.sourceTreeId}`;
                    const isSelected = selectedMembers.has(key);
                    const dateRange = formatDateRange(member.birthDate, member.deathDate);

                    return (
                      <div
                        key={key}
                        className={`flex items-start gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${
                          member.alreadyInTree ? "opacity-50 cursor-not-allowed" :
                          isSelected ? "bg-primary/10" :
                          "hover:bg-accent/50"
                        }`}
                        onClick={() => !member.alreadyInTree && toggleMember(member)}
                        data-testid={`pool-member-${member.id}`}
                      >
                        <Checkbox
                          checked={isSelected}
                          disabled={member.alreadyInTree}
                          onCheckedChange={() => !member.alreadyInTree && toggleMember(member)}
                          className="mt-1"
                          data-testid={`checkbox-pool-${member.id}`}
                        />
                        <Avatar className="h-9 w-9 flex-shrink-0">
                          <AvatarImage src={member.photoUrl || undefined} />
                          <AvatarFallback className="text-xs">
                            {(member.firstName?.[0] || "") + (member.lastName?.[0] || "")}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium">
                              {member.firstName} {member.lastName || ""}
                            </span>
                            {member.alreadyInTree && (
                              <Badge variant="outline" className="text-[10px] gap-0.5">
                                <Check className="h-2.5 w-2.5" /> In tree
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-wrap mt-0.5">
                            {dateRange && (
                              <span className="text-xs text-muted-foreground">{dateRange}</span>
                            )}
                            {member.birthPlace && (
                              <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                                <MapPin className="h-2.5 w-2.5" />
                                {member.birthPlace.length > 30 ? member.birthPlace.substring(0, 30) + '...' : member.birthPlace}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap mt-1">
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-0.5">
                              <TreeDeciduous className="h-2.5 w-2.5" />
                              {member.sourceTreeName}
                            </Badge>
                            {member.relationships.slice(0, 2).map((rel, idx) => (
                              <Badge key={idx} variant="outline" className="text-[10px] px-1.5 py-0">
                                {rel.type} of {rel.otherMemberName}
                              </Badge>
                            ))}
                            {member.relationships.length > 2 && (
                              <span className="text-[10px] text-muted-foreground">
                                +{member.relationships.length - 2} more
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </>
              ) : null}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => {
            setSelectedMembers(new Map());
            setSearchQuery("");
            setDebouncedSearch("");
            onClose();
          }} data-testid="button-cancel-pool">
            Cancel
          </Button>
          <Button
            onClick={() => importMutation.mutate()}
            disabled={selectedMembers.size === 0 || importMutation.isPending}
            data-testid="button-import-pool"
          >
            {importMutation.isPending ? "Adding..." : `Add ${selectedMembers.size} Member${selectedMembers.size > 1 ? 's' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
