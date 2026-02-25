import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, ArrowLeft, TreeDeciduous, ArrowRight, Users,
  AlertTriangle, Share2, CheckCircle2
} from "lucide-react";
import { Link } from "wouter";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader,
  DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TreeInfo {
  id: string;
  name: string;
  ownerId: string;
  ownerEmail: string | null;
  ownerName: string | null;
  treeType: string;
  memberCount: number;
  deletedAt: string | null;
}

export default function AdminTreeManager() {
  const { toast } = useToast();
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [showPopulateDialog, setShowPopulateDialog] = useState(false);
  const [selectedTree, setSelectedTree] = useState<TreeInfo | null>(null);
  const [transferTargetUserId, setTransferTargetUserId] = useState("");
  const [populateSourceTreeId, setPopulateSourceTreeId] = useState("");
  const [populatePending, setPopulatePending] = useState(false);

  const { data: isAdmin, isLoading: checkingAdmin } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["/api/admin/check"],
  });

  const { data: allTrees = [], isLoading: loadingTrees } = useQuery<TreeInfo[]>({
    queryKey: ["/api/admin/all-trees"],
    queryFn: async () => {
      const res = await fetch("/api/admin/all-trees", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch trees");
      return res.json();
    },
    enabled: isAdmin?.isAdmin === true,
  });

  const { data: allUsers = [] } = useQuery<Array<{ id: string; email: string | null; firstName: string | null; lastName: string | null }>>({
    queryKey: ["/api/admin/users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
    enabled: isAdmin?.isAdmin === true,
  });

  const transferMutation = useMutation({
    mutationFn: async ({ treeId, newOwnerId }: { treeId: string; newOwnerId: string }) => {
      return apiRequest("POST", `/api/admin/trees/${treeId}/transfer-ownership`, { newOwnerId });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/all-trees"] });
      toast({
        title: "Tree Transferred",
        description: `"${selectedTree?.name}" has been transferred successfully.`,
      });
      setShowTransferDialog(false);
      setSelectedTree(null);
      setTransferTargetUserId("");
    },
    onError: (error: Error) => {
      toast({
        title: "Transfer Failed",
        description: error.message || "Could not transfer tree",
        variant: "destructive",
      });
    },
  });

  const [syncResult, setSyncResult] = useState<any>(null);
  const [showSyncResult, setShowSyncResult] = useState(false);

  const syncFromPoolMutation = useMutation({
    mutationFn: async (treeId: string) => {
      const res = await apiRequest("POST", `/api/admin/trees/${treeId}/sync-from-pool`);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/all-trees"] });
      setSyncResult(data);
      setShowSyncResult(true);
      toast({
        title: "Sync Complete",
        description: data.summary,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Sync Failed",
        description: error.message || "Could not sync from pool",
        variant: "destructive",
      });
    },
  });

  const shareMutation = useMutation({
    mutationFn: async (treeId: string) => {
      return apiRequest("POST", `/api/admin/trees/${treeId}/share-all-members`);
    },
    onSuccess: (data: any) => {
      toast({
        title: "Members Shared",
        description: `All members are now visible in the network pool.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Share Failed",
        description: error.message || "Could not share members",
        variant: "destructive",
      });
    },
  });

  const shareAllTreesMutation = useMutation({
    mutationFn: async () => {
      const activeTrees = allTrees.filter(t => !t.deletedAt);
      const results = [];
      for (const tree of activeTrees) {
        const res = await apiRequest("POST", `/api/admin/trees/${tree.id}/share-all-members`);
        results.push(res);
      }
      return results;
    },
    onSuccess: () => {
      toast({
        title: "All Members Shared",
        description: "All members across all trees are now visible in the network pool.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Share Failed",
        description: error.message || "Could not share members",
        variant: "destructive",
      });
    },
  });

  if (checkingAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isAdmin?.isAdmin) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Access Denied
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard">
              <Button data-testid="button-back-dashboard">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeTrees = allTrees.filter(t => !t.deletedAt);
  const groupedByOwner = new Map<string, { ownerEmail: string | null; ownerName: string | null; ownerId: string; trees: TreeInfo[] }>();
  for (const tree of activeTrees) {
    if (!groupedByOwner.has(tree.ownerId)) {
      groupedByOwner.set(tree.ownerId, {
        ownerId: tree.ownerId,
        ownerEmail: tree.ownerEmail,
        ownerName: tree.ownerName,
        trees: [],
      });
    }
    groupedByOwner.get(tree.ownerId)!.trees.push(tree);
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-6">
        <Link href="/dashboard">
          <Button variant="ghost" size="sm" data-testid="button-back-dashboard">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TreeDeciduous className="h-5 w-5" />
            Admin - Tree Manager
          </CardTitle>
          <CardDescription>
            View all trees across all users. Transfer tree ownership and manage member sharing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Button
              variant="outline"
              onClick={() => shareAllTreesMutation.mutate()}
              disabled={shareAllTreesMutation.isPending}
              data-testid="button-share-all-trees"
            >
              {shareAllTreesMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Share2 className="h-4 w-4 mr-2" />
              )}
              Share All Members in All Trees
            </Button>
          </div>
        </CardContent>
      </Card>

      {loadingTrees ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(groupedByOwner.entries()).map(([ownerId, group]) => (
            <Card key={ownerId}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {group.ownerEmail || group.ownerName || ownerId}
                  <Badge variant="outline" className="text-xs">{group.trees.length} tree{group.trees.length !== 1 ? 's' : ''}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {group.trees.map(tree => (
                    <div
                      key={tree.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card"
                      data-testid={`tree-row-${tree.id}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <TreeDeciduous className="h-5 w-5 text-primary flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{tree.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant="secondary" className="text-[10px]">{tree.treeType}</Badge>
                            <span className="text-xs text-muted-foreground">{tree.memberCount} members</span>
                            <span className="text-[10px] text-muted-foreground font-mono">{tree.id.slice(0, 8)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (!confirm(`Sync "${tree.name}" from all other trees? This will add missing members and fill in empty fields.`)) return;
                            syncFromPoolMutation.mutate(tree.id);
                          }}
                          disabled={syncFromPoolMutation.isPending}
                          data-testid={`button-sync-${tree.id}`}
                        >
                          {syncFromPoolMutation.isPending ? (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                          )}
                          Sync from Pool
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => shareMutation.mutate(tree.id)}
                          disabled={shareMutation.isPending}
                          data-testid={`button-share-${tree.id}`}
                        >
                          <Share2 className="h-3 w-3 mr-1" />
                          Share All
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedTree(tree);
                            setPopulateSourceTreeId("");
                            setShowPopulateDialog(true);
                          }}
                          data-testid={`button-populate-${tree.id}`}
                        >
                          <Users className="h-3 w-3 mr-1" />
                          Populate
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedTree(tree);
                            setShowTransferDialog(true);
                          }}
                          data-testid={`button-transfer-${tree.id}`}
                        >
                          <ArrowRight className="h-3 w-3 mr-1" />
                          Transfer
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showTransferDialog} onOpenChange={(open) => {
        if (!open) {
          setShowTransferDialog(false);
          setSelectedTree(null);
          setTransferTargetUserId("");
        }
      }}>
        <DialogContent data-testid="dialog-transfer-tree">
          <DialogHeader>
            <DialogTitle>Transfer Tree Ownership</DialogTitle>
            <DialogDescription>
              Transfer "{selectedTree?.name}" to a different user. This only changes who owns the tree — all members and relationships stay intact.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <p className="text-sm font-medium mb-1">Current Owner</p>
              <p className="text-sm text-muted-foreground">
                {selectedTree?.ownerEmail || selectedTree?.ownerName || selectedTree?.ownerId}
              </p>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Transfer To</p>
              <Select value={transferTargetUserId} onValueChange={setTransferTargetUserId}>
                <SelectTrigger data-testid="select-transfer-target">
                  <SelectValue placeholder="Select a user..." />
                </SelectTrigger>
                <SelectContent>
                  {allUsers
                    .filter(u => u.id !== selectedTree?.ownerId)
                    .map(u => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.email || `${u.firstName} ${u.lastName}`} ({u.id})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowTransferDialog(false);
                setSelectedTree(null);
                setTransferTargetUserId("");
              }}
              data-testid="button-cancel-transfer"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedTree && transferTargetUserId) {
                  transferMutation.mutate({
                    treeId: selectedTree.id,
                    newOwnerId: transferTargetUserId,
                  });
                }
              }}
              disabled={!transferTargetUserId || transferMutation.isPending}
              data-testid="button-confirm-transfer"
            >
              {transferMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ArrowRight className="h-4 w-4 mr-2" />
              )}
              Transfer Tree
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPopulateDialog} onOpenChange={(open) => {
        if (!open) {
          setShowPopulateDialog(false);
          setSelectedTree(null);
          setPopulateSourceTreeId("");
        }
      }}>
        <DialogContent data-testid="dialog-populate-tree">
          <DialogHeader>
            <DialogTitle>Populate Tree from Source</DialogTitle>
            <DialogDescription>
              Copy all members and relationships from a source tree into "{selectedTree?.name}".
              Members that already exist (by name match) will be skipped but their missing fields will be filled in.
              All relationships will be recreated in the target tree.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Source Tree</label>
              <Select value={populateSourceTreeId} onValueChange={setPopulateSourceTreeId}>
                <SelectTrigger data-testid="select-populate-source">
                  <SelectValue placeholder="Pick a tree to copy from..." />
                </SelectTrigger>
                <SelectContent>
                  {activeTrees
                    .filter(t => t.id !== selectedTree?.id)
                    .map(t => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} ({t.memberCount} members)
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="p-3 bg-muted rounded-lg text-xs space-y-1">
              <p><strong>Target:</strong> {selectedTree?.name} ({selectedTree?.memberCount} current members)</p>
              <p>Existing members will keep their data. New members will be added. All source relationships will be created.</p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowPopulateDialog(false);
                setSelectedTree(null);
                setPopulateSourceTreeId("");
              }}
              data-testid="button-cancel-populate"
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!selectedTree || !populateSourceTreeId) return;
                setPopulatePending(true);
                try {
                  const res = await apiRequest("POST", `/api/admin/trees/${selectedTree.id}/populate-from/${populateSourceTreeId}`);
                  const data = await res.json();
                  toast({
                    title: "Tree Populated",
                    description: `Added ${data.membersAdded} members, skipped ${data.membersSkipped} existing. Added ${data.relationshipsAdded} relationships.`,
                  });
                  setShowPopulateDialog(false);
                  setSelectedTree(null);
                  setPopulateSourceTreeId("");
                  queryClient.invalidateQueries({ queryKey: ["/api/admin/all-trees"] });
                  queryClient.invalidateQueries({ queryKey: ["/api/trees"] });
                } catch (err: any) {
                  toast({ title: "Failed", description: err.message, variant: "destructive" });
                } finally {
                  setPopulatePending(false);
                }
              }}
              disabled={!populateSourceTreeId || populatePending}
              data-testid="button-confirm-populate"
            >
              {populatePending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Populate Tree
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={showSyncResult} onOpenChange={(open) => {
        if (!open) { setShowSyncResult(false); setSyncResult(null); }
      }}>
        <DialogContent className="max-w-lg" data-testid="dialog-sync-result">
          <DialogHeader>
            <DialogTitle>Sync Results</DialogTitle>
            <DialogDescription>{syncResult?.summary}</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-4 py-2">
              {syncResult?.added?.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-green-600 mb-1">Added ({syncResult.added.length})</p>
                  {syncResult.added.map((a: string, i: number) => (
                    <p key={i} className="text-xs text-muted-foreground">{a}</p>
                  ))}
                </div>
              )}
              {syncResult?.updated?.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-blue-600 mb-1">Updated ({syncResult.updated.length})</p>
                  {syncResult.updated.map((u: string, i: number) => (
                    <p key={i} className="text-xs text-muted-foreground">{u}</p>
                  ))}
                </div>
              )}
              {syncResult?.skipped?.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Skipped ({syncResult.skipped.length})</p>
                  {syncResult.skipped.map((s: string, i: number) => (
                    <p key={i} className="text-xs text-muted-foreground">{s}</p>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button onClick={() => { setShowSyncResult(false); setSyncResult(null); }} data-testid="button-close-sync">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
