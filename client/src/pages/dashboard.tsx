import { useState, useEffect } from "react";
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
import { Trees, Plus, Search, Users, User, Calendar, MoreVertical, LogOut, Settings, Edit, Trash2, Share2, ShoppingBag, Gift, QrCode, Menu, UserCircle, HelpCircle, Shield, Link2, RefreshCw } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ShareTreeDialog } from "@/components/share-tree-dialog";
import { PendingClaimsSection } from "@/components/pending-claims";
import { PendingCustodianshipSection } from "@/components/pending-custodianship";
import { PendingConnectionsSection } from "@/components/pending-connections";
import { MyConnectionsSection } from "@/components/my-connections";
import { PaymentGateDialog } from "@/components/payment-gate-dialog";
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
  const [settingsTreeId, setSettingsTreeId] = useState<string | null>(null);
  const [settingsTree, setSettingsTree] = useState<FamilyTreeWithCount | null>(null);
  const [settingsVisibility, setSettingsVisibility] = useState<"full" | "extended" | "limited">("extended");
  const [pendingConnectionInfo, setPendingConnectionInfo] = useState<{ userId: string; redirectUrl: string } | null>(null);
  const [showPaymentGate, setShowPaymentGate] = useState(false);
  const [paymentGateInfo, setPaymentGateInfo] = useState<{ limit: number; current: number }>({ limit: 1, current: 1 });

  // Check for pending profile redirect (from QR code scan before login)
  // Improved: Immediately redirect to complete the connection flow
  useEffect(() => {
    if (!user) return;
    
    const pendingRedirect = localStorage.getItem("pendingProfileRedirect");
    const pendingConnectionUserId = localStorage.getItem("pendingConnectionUserId");
    
    if (pendingRedirect && pendingConnectionUserId) {
      // Store info for banner display as fallback
      setPendingConnectionInfo({ userId: pendingConnectionUserId, redirectUrl: pendingRedirect });
      // Redirect immediately to complete connection
      navigate(pendingRedirect);
    }
  }, [user, navigate]);

  const { data: trees, isLoading } = useQuery<FamilyTreeWithCount[]>({
    queryKey: ["/api/trees"],
  });

  // Check if current user is admin
  const { data: adminCheck } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["/api/admin/check"],
    enabled: !!user,
  });
  const isAdmin = adminCheck?.isAdmin || false;

  const createTreeMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string; privacy: "private" | "public" }) => {
      const res = await fetch("/api/trees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const errorData = await res.json();
        if (res.status === 402 && errorData.code === "FREE_TIER_TREE_LIMIT") {
          throw { isPaymentGate: true, ...errorData };
        }
        throw new Error(errorData.message || "Failed to create tree");
      }
      return res.json();
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
    onError: (error: any) => {
      if (error.isPaymentGate) {
        setIsCreateDialogOpen(false);
        setPaymentGateInfo({ limit: error.limit, current: error.current });
        setShowPaymentGate(true);
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to create family tree",
          variant: "destructive",
        });
      }
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

  const updateTreeSettingsMutation = useMutation({
    mutationFn: async ({ id, visibilityDefault }: { id: string; visibilityDefault: string }) => {
      return apiRequest("PATCH", `/api/trees/${id}`, { visibilityDefault });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trees"] });
      setSettingsTreeId(null);
      setSettingsTree(null);
      toast({
        title: "Success",
        description: "Privacy settings updated successfully!",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update privacy settings",
        variant: "destructive",
      });
    },
  });

  const handleSettingsClick = (e: React.MouseEvent, tree: FamilyTreeWithCount) => {
    e.stopPropagation();
    setSettingsTreeId(tree.id);
    setSettingsTree(tree);
    setSettingsVisibility((tree.visibilityDefault as "full" | "extended" | "limited") || "extended");
  };

  const handleSettingsSubmit = () => {
    if (settingsTreeId) {
      updateTreeSettingsMutation.mutate({ id: settingsTreeId, visibilityDefault: settingsVisibility });
    }
  };

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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden" data-testid="button-mobile-menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem 
                  className="flex items-start gap-2"
                  onClick={() => navigate("/merchandise")}
                  data-testid="mobile-menu-merchandise"
                >
                  <ShoppingBag className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-medium">Print My Tree</div>
                    <div className="text-xs text-muted-foreground">Your tree on mugs, shirts, etc.</div>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="flex items-start gap-2"
                  onClick={() => navigate("/gifts")}
                  data-testid="mobile-menu-gifts"
                >
                  <Gift className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-medium">Browse Gift Ideas</div>
                    <div className="text-xs text-muted-foreground">Pre-made items from Amazon</div>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="flex items-center gap-2"
                  onClick={() => navigate("/share")}
                  data-testid="mobile-menu-share"
                >
                  <QrCode className="h-4 w-4" />
                  <span>Share App</span>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="flex items-center gap-2"
                  onClick={() => navigate("/faq")}
                  data-testid="mobile-menu-faq"
                >
                  <HelpCircle className="h-4 w-4" />
                  <span>Help & FAQ</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={() => navigate("/merchandise")} className="hidden md:flex gap-1" data-testid="link-merchandise">
                  <ShoppingBag className="h-4 w-4" />
                  <span className="hidden lg:inline">Print Tree</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Print YOUR family tree on mugs, shirts, posters & more</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={() => navigate("/gifts")} className="hidden md:flex gap-1" data-testid="link-gifts">
                  <Gift className="h-4 w-4" />
                  <span className="hidden lg:inline">Gift Ideas</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Browse pre-made gift ideas from Amazon</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={() => navigate("/my-qr")} className="hidden md:flex gap-1" data-testid="link-my-qr">
                  <UserCircle className="h-4 w-4" />
                  <span className="hidden lg:inline">My QR</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Share your profile QR code at family reunions</p>
              </TooltipContent>
            </Tooltip>
            <Button variant="ghost" size="sm" onClick={() => navigate("/share")} className="hidden md:flex gap-1" data-testid="link-share">
              <QrCode className="h-4 w-4" />
              <span className="hidden lg:inline">Share</span>
            </Button>
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
                  className="flex items-center gap-2 sm:hidden"
                  onClick={() => navigate("/merchandise")}
                  data-testid="menu-merchandise"
                >
                  <ShoppingBag className="h-4 w-4" />
                  <span>Shop Merchandise</span>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="flex items-center gap-2 sm:hidden"
                  onClick={() => navigate("/gifts")}
                  data-testid="menu-gifts"
                >
                  <Gift className="h-4 w-4" />
                  <span>Gift Ideas</span>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="flex items-center gap-2 sm:hidden"
                  onClick={() => navigate("/my-qr")}
                  data-testid="menu-my-qr"
                >
                  <UserCircle className="h-4 w-4" />
                  <span>My QR Code</span>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="flex items-center gap-2 sm:hidden"
                  onClick={() => navigate("/share")}
                  data-testid="menu-share"
                >
                  <QrCode className="h-4 w-4" />
                  <span>Share App</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="sm:hidden" />
                <DropdownMenuItem 
                  className="flex items-center gap-2"
                  onClick={() => navigate("/my-profile")}
                  data-testid="menu-my-profile"
                >
                  <User className="h-4 w-4" />
                  <span>My Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="flex items-center gap-2"
                  onClick={() => navigate("/account/settings")}
                  data-testid="button-account-settings"
                >
                  <Settings className="h-4 w-4" />
                  <span>Account Settings</span>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="flex items-center gap-2"
                  onClick={() => navigate("/faq")}
                  data-testid="menu-faq"
                >
                  <HelpCircle className="h-4 w-4" />
                  <span>Help & FAQ</span>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="flex items-center gap-2"
                  onClick={() => navigate("/manage-relationships")}
                  data-testid="menu-manage-relationships"
                >
                  <Link2 className="h-4 w-4" />
                  <span>Manage Relationships</span>
                </DropdownMenuItem>
                {isAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      className="flex items-center gap-2"
                      onClick={() => navigate("/admin/users")}
                      data-testid="menu-admin-users"
                    >
                      <Shield className="h-4 w-4" />
                      <span>Admin - Users</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className="flex items-center gap-2"
                      onClick={() => navigate("/admin/videos")}
                      data-testid="menu-admin-videos"
                    >
                      <Shield className="h-4 w-4" />
                      <span>Admin - Videos</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className="flex items-center gap-2"
                      onClick={() => navigate("/admin/relationships")}
                      data-testid="menu-admin-relationships"
                    >
                      <Shield className="h-4 w-4" />
                      <span>Admin - Relationships</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className="flex items-center gap-2"
                      onClick={() => navigate("/admin/members")}
                      data-testid="menu-admin-members"
                    >
                      <Shield className="h-4 w-4" />
                      <span>Admin - Members</span>
                    </DropdownMenuItem>
                  </>
                )}
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
        {/* Pending connection banner - shows if user has a pending connection to complete */}
        {pendingConnectionInfo && (
          <div className="mb-6 p-4 bg-primary/10 border border-primary/20 rounded-lg flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <UserCircle className="h-6 w-6 text-primary" />
              <div>
                <p className="font-medium">Complete your connection!</p>
                <p className="text-sm text-muted-foreground">
                  You scanned someone's QR code - tap the button to connect with them.
                </p>
              </div>
            </div>
            <Button 
              onClick={() => navigate(pendingConnectionInfo.redirectUrl)}
              data-testid="button-complete-connection"
            >
              Connect Now
            </Button>
          </div>
        )}

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold mb-1">
              Welcome back, {user?.firstName || "there"}!
            </h1>
            <p className="text-muted-foreground">
              Manage and explore your family trees
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/trees"] })}
              title="Refresh tree data"
              data-testid="button-refresh-trees"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
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
        </div>

        {/* Pending Family Connection Requests Section */}
        <div className="mb-8">
          <PendingConnectionsSection />
        </div>

        {/* My Family Connections Section */}
        <div className="mb-8">
          <MyConnectionsSection />
        </div>

        {/* Pending Profile Claims Section */}
        <div className="mb-8">
          <PendingClaimsSection />
        </div>

        {/* Pending Custodianship Requests Section */}
        <div className="mb-8">
          <PendingCustodianshipSection />
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
                      <DropdownMenuItem 
                        className="gap-2"
                        onClick={(e) => handleSettingsClick(e, tree)}
                        data-testid={`button-settings-tree-${tree.id}`}
                      >
                        <Settings className="h-4 w-4" />
                        Privacy Settings
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

      <Dialog open={!!settingsTreeId} onOpenChange={(open) => {
        if (!open) {
          setSettingsTreeId(null);
          setSettingsTree(null);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif">Privacy Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 pt-4">
            <div className="space-y-2">
              <Label className="text-base font-medium">Default Visibility for Non-Immediate Family</Label>
              <p className="text-sm text-muted-foreground">
                Control how much information is visible to people outside immediate family (parents, siblings, children, spouse).
              </p>
            </div>
            
            <div className="space-y-3">
              <div 
                className={`p-4 rounded-lg border cursor-pointer transition-colors ${settingsVisibility === "full" ? "border-primary bg-primary/5" : "border-border hover-elevate"}`}
                onClick={() => setSettingsVisibility("full")}
                data-testid="option-visibility-full"
              >
                <div className="flex items-start gap-3">
                  <div className={`w-4 h-4 mt-0.5 rounded-full border-2 flex items-center justify-center ${settingsVisibility === "full" ? "border-primary" : "border-muted-foreground"}`}>
                    {settingsVisibility === "full" && <div className="w-2 h-2 rounded-full bg-primary" />}
                  </div>
                  <div>
                    <div className="font-medium">Full Access</div>
                    <p className="text-sm text-muted-foreground">All details visible including dates, locations, photos, notes, and life events</p>
                  </div>
                </div>
              </div>
              
              <div 
                className={`p-4 rounded-lg border cursor-pointer transition-colors ${settingsVisibility === "extended" ? "border-primary bg-primary/5" : "border-border hover-elevate"}`}
                onClick={() => setSettingsVisibility("extended")}
                data-testid="option-visibility-extended"
              >
                <div className="flex items-start gap-3">
                  <div className={`w-4 h-4 mt-0.5 rounded-full border-2 flex items-center justify-center ${settingsVisibility === "extended" ? "border-primary" : "border-muted-foreground"}`}>
                    {settingsVisibility === "extended" && <div className="w-2 h-2 rounded-full bg-primary" />}
                  </div>
                  <div>
                    <div className="font-medium">Extended Family View</div>
                    <p className="text-sm text-muted-foreground">Name, relationship, birth year, and photo only. No contact info or detailed events.</p>
                  </div>
                </div>
              </div>
              
              <div 
                className={`p-4 rounded-lg border cursor-pointer transition-colors ${settingsVisibility === "limited" ? "border-primary bg-primary/5" : "border-border hover-elevate"}`}
                onClick={() => setSettingsVisibility("limited")}
                data-testid="option-visibility-limited"
              >
                <div className="flex items-start gap-3">
                  <div className={`w-4 h-4 mt-0.5 rounded-full border-2 flex items-center justify-center ${settingsVisibility === "limited" ? "border-primary" : "border-muted-foreground"}`}>
                    {settingsVisibility === "limited" && <div className="w-2 h-2 rounded-full bg-primary" />}
                  </div>
                  <div>
                    <div className="font-medium">Limited View</div>
                    <p className="text-sm text-muted-foreground">Name and relationship only. Best for distant relatives or public trees.</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-2 pt-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setSettingsTreeId(null);
                  setSettingsTree(null);
                }}
                data-testid="button-cancel-settings"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSettingsSubmit}
                disabled={updateTreeSettingsMutation.isPending}
                data-testid="button-save-settings"
              >
                {updateTreeSettingsMutation.isPending ? "Saving..." : "Save Settings"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <PaymentGateDialog
        open={showPaymentGate}
        onOpenChange={setShowPaymentGate}
        type="tree"
        limit={paymentGateInfo.limit}
        current={paymentGateInfo.current}
      />
    </div>
  );
}
