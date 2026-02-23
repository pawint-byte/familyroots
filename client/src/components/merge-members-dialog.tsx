import { useState, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { parseDateString } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Users, Calendar, MapPin, User, AlertTriangle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { FamilyMember, Relationship } from "@shared/schema";

interface MergeMembersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceMember: FamilyMember;
  allMembers: FamilyMember[];
  relationships: Relationship[];
  treeId: string;
  currentUserId?: string;
}

export function MergeMembersDialog({
  open,
  onOpenChange,
  sourceMember,
  allMembers,
  relationships,
  treeId,
  currentUserId
}: MergeMembersDialogProps) {
  const [targetMemberId, setTargetMemberId] = useState<string>("");
  const { toast } = useToast();

  const targetMember = useMemo(() => {
    return allMembers.find(m => m.id === targetMemberId);
  }, [allMembers, targetMemberId]);

  const eligibleMembers = useMemo(() => {
    return allMembers.filter(m => 
      m.id !== sourceMember.id && 
      (!m.claimedByUserId || m.claimedByUserId === currentUserId)
    );
  }, [allMembers, sourceMember.id, currentUserId]);

  const handleClose = (open: boolean) => {
    if (!open) {
      setTargetMemberId("");
    }
    onOpenChange(open);
  };

  const getRelationshipsForMember = (memberId: string) => {
    return relationships.filter(
      r => r.fromMemberId === memberId || r.toMemberId === memberId
    );
  };

  const getMemberName = (id: string) => {
    const m = allMembers.find(member => member.id === id);
    return m ? `${m.firstName}${m.lastName ? ` ${m.lastName}` : ''}` : 'Unknown';
  };

  const sourceRelationships = getRelationshipsForMember(sourceMember.id);
  const targetRelationships = targetMember ? getRelationshipsForMember(targetMember.id) : [];

  const formatDate = (date: string | null | undefined) => {
    if (!date) return null;
    const parsed = parseDateString(date);
    if (!parsed) return date;
    return parsed.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const mergeMutation = useMutation({
    mutationFn: async () => {
      if (!targetMember) throw new Error("No target member selected");
      const response = await apiRequest("POST", `/api/trees/${treeId}/members/merge`, {
        sourceMemberId: sourceMember.id,
        targetMemberId: targetMember.id
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Members merged successfully",
        description: `${sourceMember.firstName} has been merged into ${targetMember?.firstName || 'the target member'}`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/trees', treeId] });
      queryClient.invalidateQueries({ queryKey: ['/api/trees', treeId, 'merged'] });
      onOpenChange(false);
      setTargetMemberId("");
    },
    onError: async (error: any) => {
      let errorMessage = "Failed to merge members";
      try {
        if (error.response) {
          const data = await error.response.json();
          errorMessage = data.message || errorMessage;
        } else if (error.message) {
          errorMessage = error.message;
        }
      } catch {
        if (error.message) {
          errorMessage = error.message;
        }
      }
      toast({
        title: "Merge failed",
        description: errorMessage,
        variant: "destructive"
      });
    }
  });

  const handleMerge = () => {
    if (!targetMemberId) {
      toast({
        title: "Select a member",
        description: "Please select a member to merge with",
        variant: "destructive"
      });
      return;
    }
    mergeMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Merge Family Members
          </DialogTitle>
          <DialogDescription>
            Merge "{sourceMember.firstName}" with another member. This will combine their relationships and delete the duplicate.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div className="text-sm text-amber-800 dark:text-amber-200">
              <p className="font-medium">This action cannot be undone</p>
              <p>The source member will be removed and their relationships will be transferred to the target member. Make sure these are truly the same person before proceeding.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,1fr] gap-4 items-start">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Badge variant="destructive">Will be removed</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={sourceMember.photoUrl || undefined} />
                    <AvatarFallback>
                      {sourceMember.firstName[0]}{sourceMember.lastName?.[0] || ''}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">
                      {sourceMember.firstName} {sourceMember.lastName || ''}
                    </p>
                    {sourceMember.gender && (
                      <Badge variant="outline" className="text-xs">{sourceMember.gender}</Badge>
                    )}
                  </div>
                </div>
                
                {(sourceMember.birthDate || sourceMember.birthPlace) && (
                  <div className="text-sm text-muted-foreground space-y-1">
                    {sourceMember.birthDate && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3 w-3" />
                        Born: {formatDate(sourceMember.birthDate)}
                      </div>
                    )}
                    {sourceMember.birthPlace && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3 w-3" />
                        {sourceMember.birthPlace}
                      </div>
                    )}
                  </div>
                )}

                {sourceRelationships.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      {sourceRelationships.length} relationship(s) to transfer:
                    </p>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {sourceRelationships.map(rel => {
                        const otherId = rel.fromMemberId === sourceMember.id ? rel.toMemberId : rel.fromMemberId;
                        return (
                          <Badge key={rel.id} variant="secondary" className="text-xs mr-1">
                            {rel.relationshipType} with {getMemberName(otherId)}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex items-center justify-center py-4">
              <ArrowRight className="h-6 w-6 text-muted-foreground" />
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Badge variant="default">Will be kept</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label>Select member to merge into</Label>
                  <Select value={targetMemberId} onValueChange={setTargetMemberId}>
                    <SelectTrigger data-testid="select-merge-target">
                      <SelectValue placeholder="Choose a member..." />
                    </SelectTrigger>
                    <SelectContent>
                      {eligibleMembers.map(m => (
                        <SelectItem 
                          key={m.id} 
                          value={m.id}
                          data-testid={`select-merge-option-${m.id}`}
                        >
                          {m.firstName} {m.lastName || ''} 
                          {m.birthDate && ` (b. ${parseDateString(m.birthDate)?.getFullYear()})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {targetMember && (
                  <>
                    <div className="flex items-center gap-3 pt-2">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={targetMember.photoUrl || undefined} />
                        <AvatarFallback>
                          {targetMember.firstName[0]}{targetMember.lastName?.[0] || ''}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">
                          {targetMember.firstName} {targetMember.lastName || ''}
                        </p>
                        {targetMember.gender && (
                          <Badge variant="outline" className="text-xs">{targetMember.gender}</Badge>
                        )}
                      </div>
                    </div>
                    
                    {(targetMember.birthDate || targetMember.birthPlace) && (
                      <div className="text-sm text-muted-foreground space-y-1">
                        {targetMember.birthDate && (
                          <div className="flex items-center gap-2">
                            <Calendar className="h-3 w-3" />
                            Born: {formatDate(targetMember.birthDate)}
                          </div>
                        )}
                        {targetMember.birthPlace && (
                          <div className="flex items-center gap-2">
                            <MapPin className="h-3 w-3" />
                            {targetMember.birthPlace}
                          </div>
                        )}
                      </div>
                    )}

                    {targetRelationships.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">
                          Existing relationships ({targetRelationships.length}):
                        </p>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {targetRelationships.map(rel => {
                            const otherId = rel.fromMemberId === targetMember.id ? rel.toMemberId : rel.fromMemberId;
                            return (
                              <Badge key={rel.id} variant="secondary" className="text-xs mr-1">
                                {rel.relationshipType} with {getMemberName(otherId)}
                              </Badge>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => handleClose(false)}
              data-testid="button-cancel-merge"
            >
              Cancel
            </Button>
            <Button
              onClick={handleMerge}
              disabled={!targetMemberId || mergeMutation.isPending}
              data-testid="button-confirm-merge"
            >
              {mergeMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Merging...
                </>
              ) : (
                "Merge Members"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
