import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Copy, Link, Trash2, Users, Crown, Edit, Eye, QrCode, Download } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import type { TreeInvitation, TreeCollaborator } from "@shared/schema";

interface ShareTreeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  treeId: string;
  treeName: string;
}

export function ShareTreeDialog({ open, onOpenChange, treeId, treeName }: ShareTreeDialogProps) {
  const { toast } = useToast();
  const [newInviteRole, setNewInviteRole] = useState<"viewer" | "editor" | "co_owner">("viewer");

  const { data: invitations, isLoading: invitationsLoading } = useQuery<TreeInvitation[]>({
    queryKey: ["/api/trees", treeId, "invitations"],
    queryFn: async () => {
      const res = await fetch(`/api/trees/${treeId}/invitations`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch invitations");
      return res.json();
    },
    enabled: open,
  });

  const { data: collaborators, isLoading: collaboratorsLoading } = useQuery<TreeCollaborator[]>({
    queryKey: ["/api/trees", treeId, "collaborators"],
    queryFn: async () => {
      const res = await fetch(`/api/trees/${treeId}/collaborators`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch collaborators");
      return res.json();
    },
    enabled: open,
  });

  const createInviteMutation = useMutation({
    mutationFn: async (role: string) => {
      return apiRequest("POST", `/api/trees/${treeId}/invitations`, { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trees", treeId, "invitations"] });
      toast({ title: "Success", description: "Invitation link created!" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create invitation", variant: "destructive" });
    },
  });

  const deleteInviteMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      return apiRequest("DELETE", `/api/trees/${treeId}/invitations/${invitationId}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trees", treeId, "invitations"] });
      toast({ title: "Success", description: "Invitation deleted" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete invitation", variant: "destructive" });
    },
  });

  const updateCollaboratorMutation = useMutation({
    mutationFn: async ({ collaboratorId, role }: { collaboratorId: string; role: string }) => {
      return apiRequest("PATCH", `/api/trees/${treeId}/collaborators/${collaboratorId}`, { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trees", treeId, "collaborators"] });
      toast({ title: "Success", description: "Collaborator role updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update role", variant: "destructive" });
    },
  });

  const removeCollaboratorMutation = useMutation({
    mutationFn: async (collaboratorId: string) => {
      return apiRequest("DELETE", `/api/trees/${treeId}/collaborators/${collaboratorId}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trees", treeId, "collaborators"] });
      toast({ title: "Success", description: "Collaborator removed" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to remove collaborator", variant: "destructive" });
    },
  });

  const copyInviteLink = (inviteCode: string) => {
    const link = `${window.location.origin}/join/${inviteCode}`;
    navigator.clipboard.writeText(link);
    toast({ title: "Copied!", description: "Invite link copied to clipboard" });
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "co_owner": return <Crown className="h-4 w-4 text-yellow-500" />;
      case "editor": return <Edit className="h-4 w-4 text-blue-500" />;
      default: return <Eye className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "co_owner": return "Co-Owner";
      case "editor": return "Editor";
      default: return "Viewer";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif">Share "{treeName}"</DialogTitle>
          <DialogDescription>
            Invite others to view or collaborate on your family tree
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="qr" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="qr" data-testid="tab-qr-code">
              <QrCode className="h-4 w-4 mr-2" />
              QR Code
            </TabsTrigger>
            <TabsTrigger value="invite" data-testid="tab-invite">
              <Link className="h-4 w-4 mr-2" />
              Invite Links
            </TabsTrigger>
            <TabsTrigger value="collaborators" data-testid="tab-collaborators">
              <Users className="h-4 w-4 mr-2" />
              Collaborators
            </TabsTrigger>
          </TabsList>

          <TabsContent value="qr" className="space-y-4 mt-4">
            {(() => {
              const activeInvite = invitations?.find(inv => inv.role === "viewer") || invitations?.[0];
              const qrLink = activeInvite 
                ? `${window.location.origin}/join/${activeInvite.inviteCode}`
                : null;

              if (invitationsLoading) {
                return <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>;
              }

              if (!qrLink) {
                return (
                  <div className="text-center py-6 space-y-3">
                    <QrCode className="h-12 w-12 mx-auto text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">
                      Create an invite link first, then a scannable QR code will appear here.
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => createInviteMutation.mutate("viewer")}
                      disabled={createInviteMutation.isPending}
                      data-testid="button-create-invite-for-qr"
                    >
                      <Link className="h-4 w-4 mr-2" />
                      Create Viewer Invite
                    </Button>
                  </div>
                );
              }

              return (
                <div className="flex flex-col items-center gap-4">
                  <div className="bg-white p-4 rounded-xl" data-testid="tree-qr-code">
                    <QRCodeSVG
                      value={qrLink}
                      size={200}
                      level="H"
                      includeMargin={false}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground text-center max-w-xs">
                    Scan this QR code to join <strong>"{treeName}"</strong> as a {activeInvite?.role === "co_owner" ? "Co-Owner" : activeInvite?.role === "editor" ? "Editor" : "Viewer"}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(qrLink);
                        toast({ title: "Copied!", description: "Invite link copied to clipboard" });
                      }}
                      data-testid="button-copy-qr-link"
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Link
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const svg = document.querySelector('[data-testid="tree-qr-code"] svg');
                        if (!svg) return;
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');
                        const data = new XMLSerializer().serializeToString(svg);
                        const img = new Image();
                        img.onload = () => {
                          canvas.width = 400;
                          canvas.height = 400;
                          ctx!.fillStyle = 'white';
                          ctx!.fillRect(0, 0, 400, 400);
                          ctx!.drawImage(img, 0, 0, 400, 400);
                          const link = document.createElement('a');
                          link.download = `${treeName.replace(/\s+/g, '-')}-qr-code.png`;
                          link.href = canvas.toDataURL('image/png');
                          link.click();
                        };
                        img.src = 'data:image/svg+xml;base64,' + btoa(data);
                      }}
                      data-testid="button-download-qr"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  </div>
                </div>
              );
            })()}
          </TabsContent>

          <TabsContent value="invite" className="space-y-4 mt-4">
            <div className="flex gap-2">
              <Select value={newInviteRole} onValueChange={(v) => setNewInviteRole(v as any)}>
                <SelectTrigger className="w-[140px]" data-testid="select-invite-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Viewer</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                  <SelectItem value="co_owner">Co-Owner</SelectItem>
                </SelectContent>
              </Select>
              <Button 
                onClick={() => createInviteMutation.mutate(newInviteRole)}
                disabled={createInviteMutation.isPending}
                className="flex-1"
                data-testid="button-create-invite"
              >
                <Link className="h-4 w-4 mr-2" />
                Create Invite Link
              </Button>
            </div>

            <div className="text-sm text-muted-foreground space-y-1">
              <p><strong>Viewer:</strong> Can view the tree and members</p>
              <p><strong>Editor:</strong> Can add and edit family members</p>
              <p><strong>Co-Owner:</strong> Full control - manage members, settings, and invite others</p>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {invitationsLoading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : invitations?.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No active invitation links</p>
              ) : (
                invitations?.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between gap-2 p-2 bg-muted rounded-md">
                    <div className="flex items-center gap-2 min-w-0">
                      {getRoleIcon(inv.role)}
                      <Badge variant="outline" className="shrink-0">{getRoleLabel(inv.role)}</Badge>
                      <span className="text-xs text-muted-foreground truncate">
                        {inv.usedCount || 0} uses
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => copyInviteLink(inv.inviteCode)}
                        data-testid={`button-copy-invite-${inv.id}`}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => deleteInviteMutation.mutate(inv.id)}
                        data-testid={`button-delete-invite-${inv.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="collaborators" className="space-y-4 mt-4">
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {collaboratorsLoading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : collaborators?.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No collaborators yet. Share an invite link to add people!
                </p>
              ) : (
                collaborators?.map((collab) => (
                  <div key={collab.id} className="flex items-center justify-between gap-2 p-3 bg-muted rounded-md">
                    <div className="flex items-center gap-2 min-w-0">
                      {getRoleIcon(collab.role)}
                      <span className="text-sm truncate">{collab.userId}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select
                        value={collab.role}
                        onValueChange={(role) => updateCollaboratorMutation.mutate({ collaboratorId: collab.id, role })}
                      >
                        <SelectTrigger className="w-[110px]" data-testid={`select-collab-role-${collab.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="viewer">Viewer</SelectItem>
                          <SelectItem value="editor">Editor</SelectItem>
                          <SelectItem value="co_owner">Co-Owner</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => {
                          if (confirm("Remove this collaborator?")) {
                            removeCollaboratorMutation.mutate(collab.id);
                          }
                        }}
                        data-testid={`button-remove-collab-${collab.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
