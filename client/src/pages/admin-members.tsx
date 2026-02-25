import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Save, Users2 } from "lucide-react";
import { Link } from "wouter";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

interface FamilyTree {
  id: string;
  name: string;
  ownerId: string;
}

interface FamilyMember {
  id: string;
  treeId: string;
  firstName: string | null;
  lastName: string | null;
  nickname: string | null;
  email: string | null;
  gender: string | null;
  birthDate: string | null;
  birthPlace: string | null;
  deathDate: string | null;
  isLiving: boolean;
  photoUrl: string | null;
  notes: string | null;
}

export default function AdminMembers() {
  const { toast } = useToast();
  const [selectedTreeId, setSelectedTreeId] = useState<string>("");
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const [editForm, setEditForm] = useState<Partial<FamilyMember>>({});

  const { data: isAdmin, isLoading: checkingAdmin } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["/api/admin/check"],
  });

  const { data: trees = [], isLoading: loadingTrees } = useQuery<FamilyTree[]>({
    queryKey: ["/api/trees"],
    enabled: isAdmin?.isAdmin === true,
  });

  const [showDeleted, setShowDeleted] = useState(false);

  const { data: allMembers = [], isLoading: loadingMembers } = useQuery<FamilyMember[]>({
    queryKey: ["/api/admin/trees", selectedTreeId, "members"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/trees/${selectedTreeId}/members`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch members");
      return res.json();
    },
    enabled: !!selectedTreeId && isAdmin?.isAdmin === true,
  });

  const members = showDeleted ? allMembers : allMembers.filter((m: any) => !m.deletedAt);

  const updateMutation = useMutation({
    mutationFn: async (data: { memberId: string; updates: Partial<FamilyMember> }) => {
      return apiRequest("PATCH", `/api/admin/members/${data.memberId}`, data.updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/trees", selectedTreeId, "members"] });
      toast({ title: "Member updated successfully" });
      setSelectedMember(null);
      setEditForm({});
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to update member", 
        description: error?.message || "Unknown error",
        variant: "destructive" 
      });
    },
  });

  const handleSelectMember = (member: FamilyMember) => {
    setSelectedMember(member);
    setEditForm({
      firstName: member.firstName || "",
      lastName: member.lastName || "",
      nickname: member.nickname || "",
      email: member.email || "",
      gender: member.gender || "",
      birthDate: member.birthDate || "",
      birthPlace: member.birthPlace || "",
      deathDate: member.deathDate || "",
      isLiving: member.isLiving,
      notes: member.notes || "",
    });
  };

  const handleSave = () => {
    if (!selectedMember) return;
    updateMutation.mutate({ memberId: selectedMember.id, updates: editForm });
  };

  if (checkingAdmin || loadingTrees) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isAdmin?.isAdmin) {
    return (
      <div className="container max-w-4xl mx-auto p-6">
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">Admin access required</p>
            <Link href="/">
              <Button className="mt-4">Return Home</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <Users2 className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Admin: Edit Members</h1>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select Tree</CardTitle>
          <CardDescription>Choose a tree to view and edit its members</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedTreeId} onValueChange={setSelectedTreeId}>
            <SelectTrigger data-testid="select-tree">
              <SelectValue placeholder="Select a tree..." />
            </SelectTrigger>
            <SelectContent>
              {trees.map((tree) => (
                <SelectItem key={tree.id} value={tree.id}>
                  {tree.name} ({tree.id.slice(0, 8)})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedTreeId && (
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Members ({members.length})</CardTitle>
              <CardDescription className="flex items-center justify-between">
                <span>Click a member to edit</span>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)} />
                  <span className="text-xs">Show deleted</span>
                </label>
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingMembers ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {members.map((member) => (
                    <div
                      key={member.id}
                      className={`flex items-center justify-between p-2 rounded border cursor-pointer ${selectedMember?.id === member.id ? 'border-primary bg-primary/5' : 'hover:bg-muted'}`}
                      onClick={() => handleSelectMember(member)}
                      data-testid={`member-${member.id}`}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {member.firstName || "?"} {member.lastName || ""}
                          {member.nickname && ` (${member.nickname})`}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {member.birthDate || 'No DOB'}{member.deathDate ? ` - ${member.deathDate}` : ''} | {member.email || 'No email'} | ID: {member.id.slice(0, 8)}
                        </p>
                        {(member as any).deletedAt && <p className="text-[10px] text-red-500 font-medium">DELETED</p>}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                        {(member as any).deletedAt ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-green-600 hover:text-green-700 text-xs"
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                await apiRequest("PATCH", `/api/admin/members/${member.id}/restore`);
                                toast({ title: "Restored", description: `${member.firstName} ${member.lastName} restored` });
                                queryClient.invalidateQueries({ queryKey: ["/api/admin/trees", selectedTreeId, "members"] });
                              } catch (err: any) {
                                toast({ title: "Failed", description: err.message, variant: "destructive" });
                              }
                            }}
                            data-testid={`restore-member-${member.id}`}
                          >
                            Restore
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (!confirm(`Delete "${member.firstName} ${member.lastName}"? This will soft-delete the member and all their relationships.`)) return;
                              try {
                                await apiRequest("DELETE", `/api/admin/members/${member.id}/force-delete`);
                                toast({ title: "Deleted", description: `${member.firstName} ${member.lastName} removed` });
                                queryClient.invalidateQueries({ queryKey: ["/api/admin/trees", selectedTreeId, "members"] });
                                if (selectedMember?.id === member.id) setSelectedMember(null);
                              } catch (err: any) {
                                toast({ title: "Failed", description: err.message, variant: "destructive" });
                              }
                            }}
                            data-testid={`delete-member-${member.id}`}
                          >
                            X
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {selectedMember && (
            <Card>
              <CardHeader>
                <CardTitle>Edit Member</CardTitle>
                <CardDescription>ID: {selectedMember.id}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>First Name</Label>
                    <Input
                      value={editForm.firstName || ""}
                      onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                      data-testid="input-firstName"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Last Name</Label>
                    <Input
                      value={editForm.lastName || ""}
                      onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                      data-testid="input-lastName"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Nickname</Label>
                  <Input
                    value={editForm.nickname || ""}
                    onChange={(e) => setEditForm({ ...editForm, nickname: e.target.value })}
                    data-testid="input-nickname"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={editForm.email || ""}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    data-testid="input-email"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Gender</Label>
                  <Select 
                    value={editForm.gender || ""} 
                    onValueChange={(v) => setEditForm({ ...editForm, gender: v })}
                  >
                    <SelectTrigger data-testid="select-gender">
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Birth Date</Label>
                    <Input
                      type="date"
                      value={editForm.birthDate || ""}
                      onChange={(e) => setEditForm({ ...editForm, birthDate: e.target.value })}
                      data-testid="input-birthDate"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Birth Place</Label>
                    <Input
                      value={editForm.birthPlace || ""}
                      onChange={(e) => setEditForm({ ...editForm, birthPlace: e.target.value })}
                      data-testid="input-birthPlace"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <Label>Living</Label>
                  <Switch
                    checked={editForm.isLiving ?? true}
                    onCheckedChange={(checked) => setEditForm({ ...editForm, isLiving: checked })}
                    data-testid="switch-isLiving"
                  />
                </div>

                {!editForm.isLiving && (
                  <div className="space-y-2">
                    <Label>Death Date</Label>
                    <Input
                      type="date"
                      value={editForm.deathDate || ""}
                      onChange={(e) => setEditForm({ ...editForm, deathDate: e.target.value })}
                      data-testid="input-deathDate"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={editForm.notes || ""}
                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                    rows={3}
                    data-testid="input-notes"
                  />
                </div>

                <Button 
                  onClick={handleSave} 
                  disabled={updateMutation.isPending}
                  className="w-full"
                  data-testid="button-save"
                >
                  {updateMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save Changes
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
