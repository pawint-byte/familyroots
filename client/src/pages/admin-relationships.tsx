import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { parseDateString } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { 
  Loader2, ArrowLeft, Trash2, ArrowRight, Plus, AlertTriangle, Link2
} from "lucide-react";
import { Link } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { FamilyTree, FamilyMember, Relationship } from "@shared/schema";

interface TreeWithMembers {
  tree: FamilyTree;
  members: FamilyMember[];
  relationships: Relationship[];
}

const RELATIONSHIP_LABELS: Record<string, string> = {
  parent: "is PARENT of",
  child: "is CHILD of",
  spouse: "is SPOUSE of",
  sibling: "is SIBLING of",
};

const RELATIONSHIP_COLORS: Record<string, string> = {
  parent: "bg-blue-500",
  child: "bg-green-500",
  spouse: "bg-pink-500",
  sibling: "bg-purple-500",
};

export default function AdminRelationships() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedTreeId, setSelectedTreeId] = useState<string>("");
  const [relationshipToDelete, setRelationshipToDelete] = useState<Relationship | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newFromMemberId, setNewFromMemberId] = useState("");
  const [newToMemberId, setNewToMemberId] = useState("");
  const [newRelationshipType, setNewRelationshipType] = useState("");

  // Check if user is admin (for showing admin badge and accessing all trees)
  const { data: adminStatus } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["/api/admin/check"],
  });

  // Get user's trees (owned + collaborated)
  const { data: allTrees = [], isLoading: loadingTrees } = useQuery<FamilyTree[]>({
    queryKey: ["/api/trees"],
  });

  // Filter to only show owned trees for non-admins
  const trees = useMemo(() => {
    if (adminStatus?.isAdmin) {
      // Admins can see all trees
      return allTrees;
    }
    // Non-admins can only see trees they own
    return allTrees.filter(tree => tree.ownerId === user?.id);
  }, [allTrees, adminStatus?.isAdmin, user?.id]);

  const { data: treeData, isLoading: loadingTree } = useQuery<TreeWithMembers>({
    queryKey: ["/api/trees", selectedTreeId],
    enabled: !!selectedTreeId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (relationshipId: string) => {
      return apiRequest("DELETE", `/api/trees/${selectedTreeId}/relationships/${relationshipId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trees", selectedTreeId] });
      toast({ 
        title: "Relationship Deleted", 
        description: "The relationship has been removed." 
      });
      setRelationshipToDelete(null);
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to delete relationship", 
        variant: "destructive" 
      });
    },
  });

  const addMutation = useMutation({
    mutationFn: async (data: { fromMemberId: string; toMemberId: string; relationshipType: string }) => {
      return apiRequest("POST", `/api/trees/${selectedTreeId}/relationships`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trees", selectedTreeId] });
      toast({ 
        title: "Relationship Added", 
        description: "The relationship has been created." 
      });
      setIsAddOpen(false);
      setNewFromMemberId("");
      setNewToMemberId("");
      setNewRelationshipType("");
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to add relationship", 
        variant: "destructive" 
      });
    },
  });

  const getMemberName = (memberId: string): string => {
    const member = treeData?.members.find(m => m.id === memberId);
    if (!member) return "Unknown";
    return member.lastName ? `${member.firstName} ${member.lastName}` : member.firstName;
  };

  const getMemberBirthYear = (memberId: string): string => {
    const member = treeData?.members.find(m => m.id === memberId);
    if (!member?.birthDate) return "";
    return parseDateString(member.birthDate)?.getFullYear().toString() || "";
  };

  const getMemberEmail = (memberId: string): string | null => {
    const member = treeData?.members.find(m => m.id === memberId);
    return member?.email || null;
  };

  if (loadingTrees) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show message if user has no trees
  if (trees.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-primary" />
              No Trees Found
            </CardTitle>
            <CardDescription>
              You need to own a family tree to manage relationships.
              Create a tree first, then you can use this tool to edit relationships.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard">
              <Button variant="outline" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Go to Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-semibold flex items-center gap-2">
                <Link2 className="h-5 w-5 text-primary" />
                Relationship Editor
                {adminStatus?.isAdmin && (
                  <Badge variant="secondary" className="text-xs">Admin</Badge>
                )}
              </h1>
              <p className="text-sm text-muted-foreground">
                View, delete, and add family relationships in your trees
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Select a Tree</CardTitle>
            <CardDescription>Choose a family tree to view and edit its relationships</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={selectedTreeId} onValueChange={setSelectedTreeId}>
              <SelectTrigger className="max-w-md" data-testid="select-tree">
                <SelectValue placeholder="Select a family tree..." />
              </SelectTrigger>
              <SelectContent>
                {trees.map((tree) => (
                  <SelectItem key={tree.id} value={tree.id}>
                    {tree.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {selectedTreeId && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle>Relationships ({treeData?.relationships.length || 0})</CardTitle>
                <CardDescription>
                  Each row shows: Person A → Relationship → Person B
                </CardDescription>
              </div>
              <Button onClick={() => setIsAddOpen(true)} className="gap-2" data-testid="button-add-relationship">
                <Plus className="h-4 w-4" />
                Add Relationship
              </Button>
            </CardHeader>
            <CardContent>
              {loadingTree ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : treeData?.relationships.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No relationships found in this tree.
                </p>
              ) : (
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Person A</TableHead>
                        <TableHead className="text-center">Relationship</TableHead>
                        <TableHead>Person B</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {treeData?.relationships.map((rel) => (
                        <TableRow key={rel.id} data-testid={`row-relationship-${rel.id}`}>
                          <TableCell>
                            <div className="font-medium">{getMemberName(rel.fromMemberId)}</div>
                            {getMemberEmail(rel.fromMemberId) && (
                              <div className="text-xs text-primary truncate max-w-[150px]" title={getMemberEmail(rel.fromMemberId) || ''}>
                                {getMemberEmail(rel.fromMemberId)}
                              </div>
                            )}
                            {getMemberBirthYear(rel.fromMemberId) && (
                              <div className="text-xs text-muted-foreground">
                                Born {getMemberBirthYear(rel.fromMemberId)}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-2">
                              <ArrowRight className="h-4 w-4 text-muted-foreground" />
                              <Badge className={RELATIONSHIP_COLORS[rel.relationshipType] || "bg-gray-500"}>
                                {RELATIONSHIP_LABELS[rel.relationshipType] || rel.relationshipType}
                              </Badge>
                              <ArrowRight className="h-4 w-4 text-muted-foreground" />
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{getMemberName(rel.toMemberId)}</div>
                            {getMemberEmail(rel.toMemberId) && (
                              <div className="text-xs text-primary truncate max-w-[150px]" title={getMemberEmail(rel.toMemberId) || ''}>
                                {getMemberEmail(rel.toMemberId)}
                              </div>
                            )}
                            {getMemberBirthYear(rel.toMemberId) && (
                              <div className="text-xs text-muted-foreground">
                                Born {getMemberBirthYear(rel.toMemberId)}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setRelationshipToDelete(rel)}
                              data-testid={`button-delete-${rel.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        )}

        {selectedTreeId && treeData && (
          <Card>
            <CardHeader>
              <CardTitle>Members in Tree ({treeData.members.length})</CardTitle>
              <CardDescription>Reference list of all family members</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                {treeData.members.map((member) => (
                  <div 
                    key={member.id} 
                    className="p-2 border rounded-md text-sm"
                    data-testid={`member-${member.id}`}
                  >
                    <div className="font-medium truncate">
                      {member.firstName} {member.lastName}
                    </div>
                    {member.birthDate && (
                      <div className="text-xs text-muted-foreground">
                        {parseDateString(member.birthDate)?.getFullYear()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      <Dialog open={!!relationshipToDelete} onOpenChange={() => setRelationshipToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Relationship?</DialogTitle>
            <DialogDescription>
              This will remove the relationship between these two family members.
              You can add it back later if needed.
            </DialogDescription>
          </DialogHeader>
          {relationshipToDelete && (
            <div className="py-4 text-center">
              <p className="text-lg">
                <strong>{getMemberName(relationshipToDelete.fromMemberId)}</strong>
                {" "}
                <Badge className={RELATIONSHIP_COLORS[relationshipToDelete.relationshipType] || "bg-gray-500"}>
                  {RELATIONSHIP_LABELS[relationshipToDelete.relationshipType]}
                </Badge>
                {" "}
                <strong>{getMemberName(relationshipToDelete.toMemberId)}</strong>
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRelationshipToDelete(null)}>
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={() => relationshipToDelete && deleteMutation.mutate(relationshipToDelete.id)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Delete Relationship"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Relationship</DialogTitle>
            <DialogDescription>
              Select two family members and their relationship type.
              Read it as: "Person A [relationship] Person B"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Person A</Label>
              <Select value={newFromMemberId} onValueChange={setNewFromMemberId}>
                <SelectTrigger data-testid="select-from-member">
                  <SelectValue placeholder="Select person A..." />
                </SelectTrigger>
                <SelectContent>
                  {treeData?.members.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      <div className="flex flex-col">
                        <span>
                          {member.firstName} {member.lastName}
                          {member.birthDate && ` (${parseDateString(member.birthDate)?.getFullYear()})`}
                        </span>
                        {member.email && (
                          <span className="text-xs text-primary">{member.email}</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Relationship Type</Label>
              <Select value={newRelationshipType} onValueChange={setNewRelationshipType}>
                <SelectTrigger data-testid="select-relationship-type">
                  <SelectValue placeholder="Select relationship..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="parent">is PARENT of (Person A is Person B's parent)</SelectItem>
                  <SelectItem value="child">is CHILD of (Person A is Person B's child)</SelectItem>
                  <SelectItem value="spouse">is SPOUSE of (Person A is Person B's partner)</SelectItem>
                  <SelectItem value="sibling">is SIBLING of (Person A is Person B's sibling)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Person B</Label>
              <Select value={newToMemberId} onValueChange={setNewToMemberId}>
                <SelectTrigger data-testid="select-to-member">
                  <SelectValue placeholder="Select person B..." />
                </SelectTrigger>
                <SelectContent>
                  {treeData?.members
                    .filter(m => m.id !== newFromMemberId)
                    .map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        <div className="flex flex-col">
                          <span>
                            {member.firstName} {member.lastName}
                            {member.birthDate && ` (${parseDateString(member.birthDate)?.getFullYear()})`}
                          </span>
                          {member.email && (
                            <span className="text-xs text-primary">{member.email}</span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {newFromMemberId && newRelationshipType && newToMemberId && (
              <div className="bg-muted p-4 rounded-md text-center">
                <p className="font-medium">
                  {getMemberName(newFromMemberId)}{" "}
                  <Badge className={RELATIONSHIP_COLORS[newRelationshipType] || "bg-gray-500"}>
                    {RELATIONSHIP_LABELS[newRelationshipType]}
                  </Badge>{" "}
                  {getMemberName(newToMemberId)}
                </p>
                {newRelationshipType === "parent" && (
                  <p className="text-sm text-muted-foreground mt-1">
                    This means {getMemberName(newFromMemberId)} is the parent, and {getMemberName(newToMemberId)} is their child.
                  </p>
                )}
                {newRelationshipType === "child" && (
                  <p className="text-sm text-muted-foreground mt-1">
                    This means {getMemberName(newFromMemberId)} is the child, and {getMemberName(newToMemberId)} is their parent.
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => addMutation.mutate({
                fromMemberId: newFromMemberId,
                toMemberId: newToMemberId,
                relationshipType: newRelationshipType,
              })}
              disabled={!newFromMemberId || !newToMemberId || !newRelationshipType || addMutation.isPending}
              data-testid="button-confirm-add"
            >
              {addMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Add Relationship"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
