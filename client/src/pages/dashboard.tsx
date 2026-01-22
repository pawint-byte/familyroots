import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/theme-toggle";
import { SEO } from "@/components/seo";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Trees, Plus, Search, Users, Calendar, MoreVertical, LogOut, Settings, Edit, Trash2, Share2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ShareTreeDialog } from "@/components/share-tree-dialog";
import type { FamilyTree } from "@shared/schema";

// Extended tree type with member count from API
type FamilyTreeWithCount = FamilyTree & { memberCount?: number };

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newTreeName, setNewTreeName] = useState("");
  const [newTreeDescription, setNewTreeDescription] = useState("");
  const [newTreePrivacy, setNewTreePrivacy] = useState<"private" | "public">("private");
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [renameTreeId, setRenameTreeId] = useState<string | null>(null);
  const [renameTreeName, setRenameTreeName] = useState("");
  const [shareTreeId, setShareTreeId] = useState<string | null>(null);
  const [shareTreeName, setShareTreeName] = useState("");

  const { data: trees, isLoading } = useQuery<FamilyTreeWithCount[]>({
    queryKey: ["/api/trees"],
  });

  const createTreeMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string; privacy: "private" | "public" }) => {
      return apiRequest("POST", "/api/trees", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trees"] });
      setIsCreateDialogOpen(false);
      setNewTreeName("");
      setNewTreeDescription("");
      setNewTreePrivacy("private");
      toast({
        title: "Success",
        description: "Family tree created successfully!",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create family tree",
        variant: "destructive",
      });
    },
  });

  const filteredTrees = trees?.filter(tree =>
    tree.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateTree = () => {
    if (!newTreeName.trim()) return;
    createTreeMutation.mutate({
      name: newTreeName,
      description: newTreeDescription || undefined,
      privacy: newTreePrivacy,
    });
  };

  const renameTreeMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      return apiRequest("PATCH", `/api/trees/${id}`, { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trees"] });
      setIsRenameDialogOpen(false);
      setRenameTreeId(null);
      setRenameTreeName("");
      toast({
        title: "Success",
        description: "Tree renamed successfully!",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to rename tree",
        variant: "destructive",
      });
    },
  });

  const deleteTreeMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/trees/${id}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trees"] });
      toast({
        title: "Success",
        description: "Tree deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete tree",
        variant: "destructive",
      });
    },
  });

  const handleRenameClick = (e: React.MouseEvent, tree: FamilyTree) => {
    e.stopPropagation();
    setRenameTreeId(tree.id);
    setRenameTreeName(tree.name);
    setIsRenameDialogOpen(true);
  };

  const handleRenameSubmit = () => {
    if (renameTreeId && renameTreeName.trim()) {
      renameTreeMutation.mutate({ id: renameTreeId, name: renameTreeName.trim() });
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, treeId: string) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this tree? This action cannot be undone.")) {
      deleteTreeMutation.mutate(treeId);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Dashboard - FamilyRoots | Manage Your Family Trees"
        description="Manage and explore your family trees. Create new trees, add family members, and preserve your heritage."
        keywords="family tree dashboard, manage genealogy, family history management"
      />
      <header className="sticky top-0 z-50 backdrop-blur-md bg-background/80 border-b border-border">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Trees className="h-7 w-7 text-primary" />
            <span className="font-serif text-xl font-semibold">FamilyRoots</span>
          </div>
          <div className="flex-1 max-w-md mx-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search your trees..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-trees"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative" data-testid="button-user-menu">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.profileImageUrl || undefined} />
                    <AvatarFallback>
                      {user?.firstName?.[0] || user?.email?.[0]?.toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem 
                  className="flex items-center gap-2"
                  onClick={() => navigate("/account/settings")}
                  data-testid="button-account-settings"
                >
                  <Settings className="h-4 w-4" />
                  <span>Account Settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  className="flex items-center gap-2 text-destructive"
                  onClick={() => logout()}
                  data-testid="button-logout"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold mb-1">
              Welcome back, {user?.firstName || "there"}!
            </h1>
            <p className="text-muted-foreground">
              Manage and explore your family trees
            </p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" data-testid="button-create-tree">
                <Plus className="h-4 w-4" />
                New Tree
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-serif">Create New Family Tree</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="tree-name">Tree Name</Label>
                  <Input
                    id="tree-name"
                    placeholder="e.g., Smith Family Tree"
                    value={newTreeName}
                    onChange={(e) => setNewTreeName(e.target.value)}
                    data-testid="input-tree-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tree-description">Description (optional)</Label>
                  <Textarea
                    id="tree-description"
                    placeholder="Add a description for your family tree..."
                    value={newTreeDescription}
                    onChange={(e) => setNewTreeDescription(e.target.value)}
                    data-testid="input-tree-description"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tree-privacy">Privacy</Label>
                  <Select value={newTreePrivacy} onValueChange={(v: "private" | "public") => setNewTreePrivacy(v)}>
                    <SelectTrigger id="tree-privacy" data-testid="select-tree-privacy">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="private">Private - Only you and collaborators</SelectItem>
                      <SelectItem value="public">Public - Anyone with the link</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button 
                  className="w-full" 
                  onClick={handleCreateTree}
                  disabled={!newTreeName.trim() || createTreeMutation.isPending}
                  data-testid="button-submit-create-tree"
                >
                  {createTreeMutation.isPending ? "Creating..." : "Create Tree"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredTrees && filteredTrees.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTrees.map((tree) => (
              <Card 
                key={tree.id} 
                className="hover-elevate cursor-pointer group"
                onClick={() => navigate(`/tree/${tree.id}`)}
                data-testid={`card-tree-${tree.id}`}
              >
                <CardHeader className="flex flex-row items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="font-serif truncate">{tree.name}</CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-1">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                        tree.privacy === "private" 
                          ? "bg-muted text-muted-foreground" 
                          : "bg-primary/10 text-primary"
                      }`}>
                        {tree.privacy === "private" ? "Private" : "Public"}
                      </span>
                    </CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem 
                        className="gap-2"
                        onClick={(e) => handleRenameClick(e, tree)}
                        data-testid={`button-rename-tree-${tree.id}`}
                      >
                        <Edit className="h-4 w-4" />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="gap-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShareTreeId(tree.id);
                          setShareTreeName(tree.name);
                        }}
                        data-testid={`button-share-tree-${tree.id}`}
                      >
                        <Share2 className="h-4 w-4" />
                        Share
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        className="gap-2 text-destructive"
                        onClick={(e) => handleDeleteClick(e, tree.id)}
                        data-testid={`button-delete-tree-${tree.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                    {tree.description || "No description"}
                  </p>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      <span>{tree.memberCount ?? 0} {(tree.memberCount ?? 0) === 1 ? 'member' : 'members'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      <span>{new Date(tree.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="text-center py-16">
            <CardContent>
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
                <Trees className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No Family Trees Yet</h3>
              <p className="text-muted-foreground mb-6">
                Start preserving your family history by creating your first tree
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)} className="gap-2" data-testid="button-create-first-tree">
                <Plus className="h-4 w-4" />
                Create Your First Tree
              </Button>
            </CardContent>
          </Card>
        )}
      </main>

      <Dialog open={isRenameDialogOpen} onOpenChange={(open) => {
        setIsRenameDialogOpen(open);
        if (!open) {
          setRenameTreeId(null);
          setRenameTreeName("");
        }
      }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif">Rename Tree</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rename-tree-name">Tree Name</Label>
              <Input
                id="rename-tree-name"
                value={renameTreeName}
                onChange={(e) => setRenameTreeName(e.target.value)}
                placeholder="Enter tree name"
                data-testid="input-rename-tree"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleRenameSubmit();
                  }
                }}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => setIsRenameDialogOpen(false)}
                data-testid="button-cancel-rename"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleRenameSubmit}
                disabled={!renameTreeName.trim() || renameTreeMutation.isPending}
                data-testid="button-save-rename"
              >
                {renameTreeMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ShareTreeDialog
        open={!!shareTreeId}
        onOpenChange={(open) => {
          if (!open) {
            setShareTreeId(null);
            setShareTreeName("");
          }
        }}
        treeId={shareTreeId || ""}
        treeName={shareTreeName}
      />
    </div>
  );
}
