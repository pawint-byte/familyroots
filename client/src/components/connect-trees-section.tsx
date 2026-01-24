import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Trees, Link2, CheckCircle2, Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ConnectedUserTree {
  id: string;
  name: string;
  isConnectedToMyTree: boolean;
}

interface ConnectedUserWithTrees {
  userId: string;
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
  } | null;
  trees: ConnectedUserTree[];
  relationshipToMe: string | null;
}

interface ConnectedUsersTreesResponse {
  myTrees: { id: string; name: string }[];
  connectedUsersTrees: ConnectedUserWithTrees[];
}

const RELATIONSHIP_LABELS: Record<string, string> = {
  son: "Son",
  daughter: "Daughter",
  parent: "Parent",
  spouse: "Spouse",
  sibling: "Sibling",
  grandparent: "Grandparent",
  grandchild: "Grandchild",
  aunt: "Aunt",
  uncle: "Uncle",
  niece: "Niece",
  nephew: "Nephew",
  cousin: "Cousin",
  in_law: "In-Law",
  step_relative: "Step-Relative",
  other: "Family",
};

export function ConnectTreesSection() {
  const { toast } = useToast();
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [selectedMyTree, setSelectedMyTree] = useState<string>("");
  const [selectedTheirTree, setSelectedTheirTree] = useState<string>("");
  const [selectedUser, setSelectedUser] = useState<ConnectedUserWithTrees | null>(null);

  const { data, isLoading } = useQuery<ConnectedUsersTreesResponse>({
    queryKey: ["/api/connected-users-trees"],
  });

  const connectTreesMutation = useMutation({
    mutationFn: async ({ myTreeId, theirTreeId }: { myTreeId: string; theirTreeId: string }) => {
      return apiRequest("POST", `/api/trees/${myTreeId}/connections`, {
        targetTreeId: theirTreeId,
        connectionType: "other",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/connected-users-trees"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trees"] });
      toast({ 
        title: "Trees connected!", 
        description: "You can now see each other's trees in the merged view." 
      });
      setConnectDialogOpen(false);
      setSelectedMyTree("");
      setSelectedTheirTree("");
      setSelectedUser(null);
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to connect trees", 
        description: error.message || "Please try again.",
        variant: "destructive" 
      });
    },
  });

  const handleConnectClick = (userWithTrees: ConnectedUserWithTrees, theirTree: ConnectedUserTree) => {
    setSelectedUser(userWithTrees);
    setSelectedTheirTree(theirTree.id);
    if (data?.myTrees.length === 1) {
      setSelectedMyTree(data.myTrees[0].id);
    }
    setConnectDialogOpen(true);
  };

  const handleConnect = () => {
    if (selectedMyTree && selectedTheirTree) {
      connectTreesMutation.mutate({ myTreeId: selectedMyTree, theirTreeId: selectedTheirTree });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-1" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Only show if there are connected users with unconnected trees
  const usersWithUnconnectedTrees = data?.connectedUsersTrees.filter(
    u => u.trees.some(t => !t.isConnectedToMyTree)
  ) || [];

  if (usersWithUnconnectedTrees.length === 0 || !data?.myTrees.length) {
    return null;
  }

  return (
    <>
      <Card data-testid="connect-trees-section">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Connect Family Trees</CardTitle>
          </div>
          <CardDescription>
            Link your tree with family members' trees to see them in merged view
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {usersWithUnconnectedTrees.map((userWithTrees) => {
              const user = userWithTrees.user;
              if (!user) return null;

              const firstName = user.firstName || "";
              const lastName = user.lastName || "";
              const fullName = `${firstName} ${lastName}`.trim() || "Family Member";
              const initials = `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase() || '?';
              const relationshipLabel = userWithTrees.relationshipToMe 
                ? RELATIONSHIP_LABELS[userWithTrees.relationshipToMe] || userWithTrees.relationshipToMe
                : null;

              const unconnectedTrees = userWithTrees.trees.filter(t => !t.isConnectedToMyTree);
              const connectedTrees = userWithTrees.trees.filter(t => t.isConnectedToMyTree);

              return (
                <div
                  key={userWithTrees.userId}
                  className="p-4 rounded-lg border bg-card"
                  data-testid={`connect-trees-user-${userWithTrees.userId}`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={user.profileImageUrl || undefined} />
                      <AvatarFallback className="bg-primary/10">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{fullName}</div>
                      {relationshipLabel && (
                        <Badge variant="secondary" className="text-xs mt-0.5">
                          Your {relationshipLabel}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    {unconnectedTrees.map((tree) => (
                      <div
                        key={tree.id}
                        className="flex items-center justify-between gap-2 p-2 rounded bg-muted/50"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Trees className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="text-sm truncate">{tree.name}</span>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleConnectClick(userWithTrees, tree)}
                          data-testid={`button-connect-tree-${tree.id}`}
                        >
                          <Link2 className="h-3 w-3 mr-1" />
                          Connect
                        </Button>
                      </div>
                    ))}

                    {connectedTrees.length > 0 && (
                      <div className="pt-2 border-t mt-2">
                        <div className="text-xs text-muted-foreground mb-1">Already connected:</div>
                        {connectedTrees.map((tree) => (
                          <div
                            key={tree.id}
                            className="flex items-center gap-2 p-2 text-sm text-muted-foreground"
                          >
                            <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                            <span className="truncate">{tree.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog open={connectDialogOpen} onOpenChange={setConnectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect Family Trees</DialogTitle>
            <DialogDescription>
              Choose which of your trees to connect with {selectedUser?.user?.firstName}'s tree.
              Once connected, you'll both be able to see each other's trees in the merged view.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Your Tree</label>
              {data?.myTrees.length === 1 ? (
                <div className="p-3 rounded border bg-muted/50">
                  <div className="flex items-center gap-2">
                    <Trees className="h-4 w-4 text-primary" />
                    <span>{data.myTrees[0].name}</span>
                  </div>
                </div>
              ) : (
                <Select value={selectedMyTree} onValueChange={setSelectedMyTree}>
                  <SelectTrigger data-testid="select-my-tree">
                    <SelectValue placeholder="Select your tree" />
                  </SelectTrigger>
                  <SelectContent>
                    {data?.myTrees.map((tree) => (
                      <SelectItem key={tree.id} value={tree.id}>
                        {tree.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="flex items-center justify-center">
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="h-px w-8 bg-border" />
                <Link2 className="h-4 w-4" />
                <div className="h-px w-8 bg-border" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{selectedUser?.user?.firstName}'s Tree</label>
              <div className="p-3 rounded border bg-muted/50">
                <div className="flex items-center gap-2">
                  <Trees className="h-4 w-4 text-primary" />
                  <span>{data?.connectedUsersTrees
                    .find(u => u.userId === selectedUser?.userId)
                    ?.trees.find(t => t.id === selectedTheirTree)?.name}</span>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConnectDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleConnect} 
              disabled={!selectedMyTree || !selectedTheirTree || connectTreesMutation.isPending}
              data-testid="button-confirm-connect"
            >
              {connectTreesMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Link2 className="h-4 w-4 mr-2" />
                  Connect Trees
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
