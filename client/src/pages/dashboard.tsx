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
import { trackTreeCreation } from "@/lib/tracking";
import { Trees, Plus, Search, Users, User, Calendar, MoreVertical, LogOut, Settings, Edit, Trash2, Share2, ShoppingBag, Gift, QrCode, Menu, UserCircle, HelpCircle, Shield, Link2, RefreshCw, TreeDeciduous, Package, CreditCard, TrendingUp, Award, Church, Trophy, GraduationCap, Heart, Briefcase, Sparkles, X, Globe, BookOpen, GitBranch, Undo2, Clock, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TREE_TYPE_CONFIGS, type TreeType } from "@shared/treeTypes";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ShareTreeDialog } from "@/components/share-tree-dialog";
import { PendingClaimsSection } from "@/components/pending-claims";
import { PendingCustodianshipSection } from "@/components/pending-custodianship";
import { PendingMatchesSection } from "@/components/pending-matches-section";
import { PendingConnectionsSection } from "@/components/pending-connections";
import { MyConnectionsSection } from "@/components/my-connections";
import { ConnectTreesSection } from "@/components/connect-trees-section";
import { NetworkRequestsSection } from "@/components/network-requests-section";
import { PaymentGateDialog } from "@/components/payment-gate-dialog";
import { ReferralSection } from "@/components/referral-section";
import { EmailInviteForm } from "@/components/email-invite-form";
import { SocialShareButtons } from "@/components/social-share-buttons";
import { InviteTemplates } from "@/components/invite-templates";
import { RevenueForecastSection } from "@/components/revenue-forecast-section";
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
  const [newTreeType, setNewTreeType] = useState<TreeType>("family");
  const [customTypeLabel, setCustomTypeLabel] = useState("");
  const [customRelTypes, setCustomRelTypes] = useState<string[]>([]);
  const [customRelTypeInput, setCustomRelTypeInput] = useState("");
  const [creatorProfileMode, setCreatorProfileMode] = useState<"full" | "basic">("full");
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [renameTreeId, setRenameTreeId] = useState<string | null>(null);
  const [renameTreeName, setRenameTreeName] = useState("");
  const [shareTreeId, setShareTreeId] = useState<string | null>(null);
  const [shareTreeName, setShareTreeName] = useState("");
  const [settingsTreeId, setSettingsTreeId] = useState<string | null>(null);
  const [settingsTree, setSettingsTree] = useState<FamilyTreeWithCount | null>(null);
  const [settingsVisibility, setSettingsVisibility] = useState<"full" | "extended" | "limited">("extended");
  const [settingsPrivacy, setSettingsPrivacy] = useState<"private" | "public">("private");
  const [pendingConnectionInfo, setPendingConnectionInfo] = useState<{ userId: string; redirectUrl: string } | null>(null);
  const [showPaymentGate, setShowPaymentGate] = useState(false);
  const [paymentGateInfo, setPaymentGateInfo] = useState<{ limit?: number; current: number; credits?: number }>({ current: 0 });

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

  // Get referral data for share links
  const { data: referralData } = useQuery<{ referralCode: string; referralLink: string }>({
    queryKey: ["/api/referrals/my"],
    enabled: !!user,
  });

  // Get pricing/credit status
  const { data: pricingStatus, isLoading: pricingLoading } = useQuery<{
    totalMemberCount: number;
    memberCredits: number;
    isPremium: boolean;
    monthlyAddsCount: number;
    hasActiveReward: boolean;
    activeRewardDiscount: number;
    config: {
      freeTierCredits: number;
      packs: Array<{ type: string; credits: number; priceCents: number; label: string }>;
      rewards: { monthlyAddsThreshold: number; monthlyDiscountPercent: number; milestoneFreePack: { memberCount: number; freeCredits: number } };
    };
  }>({
    queryKey: ["/api/pricing/status"],
    enabled: !!user,
  });

  const totalMembers = pricingStatus?.totalMemberCount || 0;
  const memberCredits = pricingStatus?.memberCredits || 0;
  const freeLimit = pricingStatus?.config?.freeTierCredits || 20;
  const freeRemaining = Math.max(0, freeLimit - totalMembers);
  const monthlyAdds = pricingStatus?.monthlyAddsCount || 0;
  const rewardThreshold = pricingStatus?.config?.rewards?.monthlyAddsThreshold || 5;

  const bulkPackMutation = useMutation({
    mutationFn: async (packType: string) => {
      const res = await apiRequest("POST", "/api/pricing/bulk-pack/checkout", { packType });
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to start checkout. Please try again.",
        variant: "destructive",
      });
    },
  });

  const createTreeMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string; privacy: "private" | "public"; treeType?: TreeType; treeTypeLabel?: string; customRelationshipTypes?: string[]; creatorProfileMode?: "full" | "basic" }) => {
      const res = await fetch("/api/trees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const errorData = await res.json();
        if (res.status === 402) {
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
      setNewTreeType("family");
      setCustomTypeLabel("");
      setCustomRelTypes([]);
      setCustomRelTypeInput("");
      setCreatorProfileMode("full");
      trackTreeCreation();
      toast({
        title: "Success",
        description: "Tree created successfully!",
      });
    },
    onError: (error: any) => {
      if (error.isPaymentGate) {
        setIsCreateDialogOpen(false);
        setPaymentGateInfo({ current: error.current || 0, credits: error.credits || 0 });
        setShowPaymentGate(true);
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to create tree",
          variant: "destructive",
        });
      }
    },
  });

  const filteredTrees = trees?.filter(tree =>
    tree.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const treeTypeIcons: Record<TreeType, typeof Users> = {
    family: Users,
    church: Church,
    sports: Trophy,
    fraternity: GraduationCap,
    friends: Heart,
    professional: Briefcase,
    custom: Sparkles,
  };

  const handleCreateTree = () => {
    if (!newTreeName.trim()) return;
    createTreeMutation.mutate({
      name: newTreeName,
      description: newTreeDescription || undefined,
      privacy: newTreePrivacy,
      treeType: newTreeType,
      creatorProfileMode,
      ...(newTreeType === "custom" ? {
        treeTypeLabel: customTypeLabel || undefined,
      } : {}),
      ...(customRelTypes.length > 0 ? {
        customRelationshipTypes: customRelTypes,
      } : {}),
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
      queryClient.invalidateQueries({ queryKey: ["/api/deleted/trees"] });
      toast({
        title: "Moved to Trash",
        description: "Tree moved to Recently Deleted. You can restore it within 30 days.",
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

  const { data: deletedTrees } = useQuery<FamilyTree[]>({
    queryKey: ["/api/deleted/trees"],
    enabled: !!user,
  });

  const [showDeletedTrees, setShowDeletedTrees] = useState(false);

  const restoreTreeMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("PATCH", `/api/deleted/trees/${id}/restore`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trees"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deleted/trees"] });
      toast({
        title: "Tree Restored",
        description: "Your tree has been restored successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to restore tree",
        variant: "destructive",
      });
    },
  });

  const permanentDeleteTreeMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/deleted/trees/${id}/permanent`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deleted/trees"] });
      toast({
        title: "Permanently Deleted",
        description: "Tree has been permanently deleted and cannot be recovered.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to permanently delete tree",
        variant: "destructive",
      });
    },
  });

  const updateTreeSettingsMutation = useMutation({
    mutationFn: async ({ id, visibilityDefault, privacy }: { id: string; visibilityDefault: string; privacy: string }) => {
      return apiRequest("PATCH", `/api/trees/${id}`, { visibilityDefault, privacy });
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
    setSettingsPrivacy((tree.privacy as "private" | "public") || "private");
  };

  const handleSettingsSubmit = () => {
    if (settingsTreeId) {
      updateTreeSettingsMutation.mutate({ id: settingsTreeId, visibilityDefault: settingsVisibility, privacy: settingsPrivacy });
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
    if (confirm("Move this tree to Recently Deleted? You can restore it within 30 days.")) {
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
              <DropdownMenuContent align="end" className="w-48 max-h-[70vh] overflow-y-auto">
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
                  className="flex items-start gap-2"
                  onClick={() => navigate("/discover")}
                  data-testid="mobile-menu-discover"
                >
                  <Search className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-medium">Discover</div>
                    <div className="text-xs text-muted-foreground">Browse and join communities</div>
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
                  className="flex items-start gap-2"
                  onClick={() => navigate("/familysearch")}
                  data-testid="mobile-menu-records"
                >
                  <BookOpen className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-medium">Records Search</div>
                    <div className="text-xs text-muted-foreground">Search FamilySearch records</div>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="flex items-center gap-2"
                  onClick={() => navigate("/faq")}
                  data-testid="mobile-menu-faq"
                >
                  <HelpCircle className="h-4 w-4" />
                  <span>Help & FAQ</span>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="flex items-center gap-2"
                  onClick={() => navigate("/features")}
                  data-testid="mobile-menu-features-guide"
                >
                  <BookOpen className="h-4 w-4" />
                  <span>Features Guide</span>
                </DropdownMenuItem>
                {isAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      className="flex items-center gap-2"
                      onClick={() => navigate("/admin/users")}
                      data-testid="mobile-menu-admin-users"
                    >
                      <Shield className="h-4 w-4" />
                      <span>Admin - Users</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className="flex items-center gap-2"
                      onClick={() => navigate("/admin/videos")}
                      data-testid="mobile-menu-admin-videos"
                    >
                      <Shield className="h-4 w-4" />
                      <span>Admin - Videos</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className="flex items-center gap-2"
                      onClick={() => navigate("/admin/relationships")}
                      data-testid="mobile-menu-admin-relationships"
                    >
                      <Shield className="h-4 w-4" />
                      <span>Admin - Relationships</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className="flex items-center gap-2"
                      onClick={() => navigate("/admin/members")}
                      data-testid="mobile-menu-admin-members"
                    >
                      <Shield className="h-4 w-4" />
                      <span>Admin - Members</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className="flex items-center gap-2"
                      onClick={() => navigate("/admin/connections")}
                      data-testid="mobile-menu-admin-connections"
                    >
                      <Link2 className="h-4 w-4" />
                      <span>Admin - Connections</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className="flex items-center gap-2"
                      onClick={() => navigate("/admin/tree-connections")}
                      data-testid="mobile-menu-admin-tree-connections"
                    >
                      <TreeDeciduous className="h-4 w-4" />
                      <span>Admin - Tree Links</span>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={() => navigate("/network-overview")} className="hidden md:flex gap-1" data-testid="link-network-overview">
                  <Globe className="h-4 w-4" />
                  <span className="hidden lg:inline">My Network</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>See all your trees and connections in one view</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={() => navigate("/discover")} className="hidden md:flex gap-1" data-testid="link-discover">
                  <Search className="h-4 w-4" />
                  <span className="hidden lg:inline">Discover</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Browse and join public communities and groups</p>
              </TooltipContent>
            </Tooltip>
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
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={() => navigate("/my-badge")} className="hidden md:flex gap-1" data-testid="link-my-badge">
                  <Award className="h-4 w-4" />
                  <span className="hidden lg:inline">My Badge</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Download and share your membership badge</p>
              </TooltipContent>
            </Tooltip>
            <Button variant="ghost" size="sm" onClick={() => navigate("/share")} className="hidden md:flex gap-1" data-testid="link-share">
              <QrCode className="h-4 w-4" />
              <span className="hidden lg:inline">Share</span>
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={() => navigate("/familysearch")} className="hidden md:flex gap-1" data-testid="link-records">
                  <BookOpen className="h-4 w-4" />
                  <span className="hidden lg:inline">Records</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Search FamilySearch historical records</p>
              </TooltipContent>
            </Tooltip>
            {isAdmin && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="hidden md:flex gap-1" data-testid="link-admin">
                    <Shield className="h-4 w-4" />
                    <span className="hidden lg:inline">Admin</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => navigate("/admin/users")} data-testid="admin-menu-users">
                    <Shield className="h-4 w-4 mr-2" />
                    Users
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/admin/videos")} data-testid="admin-menu-videos">
                    <Shield className="h-4 w-4 mr-2" />
                    Videos
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/admin/relationships")} data-testid="admin-menu-relationships">
                    <Shield className="h-4 w-4 mr-2" />
                    Relationships
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/admin/members")} data-testid="admin-menu-members">
                    <Shield className="h-4 w-4 mr-2" />
                    Members
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/admin/connections")} data-testid="admin-menu-connections">
                    <Link2 className="h-4 w-4 mr-2" />
                    Connections
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
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
                  onClick={() => navigate("/network-overview")}
                  data-testid="menu-network-overview"
                >
                  <Globe className="h-4 w-4" />
                  <span>My Network</span>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="flex items-center gap-2 sm:hidden"
                  onClick={() => navigate("/merchandise")}
                  data-testid="menu-merchandise"
                >
                  <ShoppingBag className="h-4 w-4" />
                  <span>Shop Merchandise</span>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="flex items-center gap-2"
                  onClick={() => navigate("/merchandise?tab=orders")}
                  data-testid="menu-my-orders"
                >
                  <Package className="h-4 w-4" />
                  <span>My Orders</span>
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
                  onClick={() => navigate("/my-badge")}
                  data-testid="menu-my-badge"
                >
                  <Award className="h-4 w-4" />
                  <span>My Badge</span>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="flex items-center gap-2 sm:hidden"
                  onClick={() => navigate("/share")}
                  data-testid="menu-share"
                >
                  <QrCode className="h-4 w-4" />
                  <span>Share App</span>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="flex items-center gap-2 md:hidden"
                  onClick={() => navigate("/familysearch")}
                  data-testid="menu-records"
                >
                  <BookOpen className="h-4 w-4" />
                  <span>Records Search</span>
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
                  onClick={() => navigate("/features")}
                  data-testid="menu-features-guide"
                >
                  <BookOpen className="h-4 w-4" />
                  <span>Features Guide</span>
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
                    <DropdownMenuItem 
                      className="flex items-center gap-2"
                      onClick={() => navigate("/admin/connections")}
                      data-testid="menu-admin-connections"
                    >
                      <Link2 className="h-4 w-4" />
                      <span>Admin - Connections</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className="flex items-center gap-2"
                      onClick={() => navigate("/admin/tree-connections")}
                      data-testid="menu-admin-tree-connections"
                    >
                      <TreeDeciduous className="h-4 w-4" />
                      <span>Admin - Tree Links</span>
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
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-serif">Create New Tree</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Tree Type</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.keys(TREE_TYPE_CONFIGS) as TreeType[]).map((type) => {
                      const config = TREE_TYPE_CONFIGS[type];
                      const IconComponent = treeTypeIcons[type];
                      const isSelected = newTreeType === type;
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => { setNewTreeType(type); setCustomRelTypes([]); setCustomRelTypeInput(""); }}
                          className={`flex items-center gap-3 p-3 rounded-md border text-left transition-colors ${
                            isSelected
                              ? "border-primary bg-primary/5"
                              : "border-border hover-elevate"
                          }`}
                          data-testid={`button-tree-type-${type}`}
                        >
                          <IconComponent className={`h-5 w-5 shrink-0 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                          <div className="min-w-0">
                            <div className={`text-sm font-medium truncate ${isSelected ? "text-primary" : ""}`}>
                              {config.label}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {TREE_TYPE_CONFIGS[newTreeType].description}
                  </p>
                </div>
                {newTreeType === "custom" && (
                  <div className="space-y-2">
                    <Label htmlFor="custom-type-label">Group Type Name (optional)</Label>
                    <Input
                      id="custom-type-label"
                      placeholder="e.g., Book Club, Neighborhood, Band"
                      value={customTypeLabel}
                      onChange={(e) => setCustomTypeLabel(e.target.value)}
                      data-testid="input-custom-type-label"
                    />
                  </div>
                )}
                <div className="space-y-3 bg-muted/50 rounded-lg p-3 border border-border">
                  <div>
                    <Label className="text-sm font-medium">Relationship Structure</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      These are the roles people can have in your {TREE_TYPE_CONFIGS[newTreeType].label.toLowerCase()}. You can add more.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {TREE_TYPE_CONFIGS[newTreeType].defaultRelationshipTypes.map((rel) => (
                      <span
                        key={rel.value}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-background border border-border text-xs"
                        title={rel.description}
                      >
                        {rel.label}
                        {rel.reverseLabel && (
                          <span className="text-muted-foreground">/ {rel.reverseLabel}</span>
                        )}
                      </span>
                    ))}
                    {customRelTypes.map((type) => (
                      <Badge key={type} variant="secondary" className="gap-1 text-xs">
                        {type}
                        <button
                          type="button"
                          onClick={() => setCustomRelTypes(customRelTypes.filter(t => t !== type))}
                          className="ml-0.5 hover-elevate rounded-full"
                          data-testid={`button-remove-rel-type-${type}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder={newTreeType === "custom" ? "e.g., Organizer, Participant" : `e.g., ${newTreeType === "sports" ? "Water Boy, Referee" : newTreeType === "church" ? "Usher, Greeter" : "Custom Role"}`}
                      value={customRelTypeInput}
                      onChange={(e) => setCustomRelTypeInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && customRelTypeInput.trim()) {
                          e.preventDefault();
                          if (!customRelTypes.includes(customRelTypeInput.trim())) {
                            setCustomRelTypes([...customRelTypes, customRelTypeInput.trim()]);
                          }
                          setCustomRelTypeInput("");
                        }
                      }}
                      className="text-sm"
                      data-testid="input-custom-rel-type"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (customRelTypeInput.trim() && !customRelTypes.includes(customRelTypeInput.trim())) {
                          setCustomRelTypes([...customRelTypes, customRelTypeInput.trim()]);
                          setCustomRelTypeInput("");
                        }
                      }}
                      data-testid="button-add-custom-rel-type"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add
                    </Button>
                  </div>
                  {TREE_TYPE_CONFIGS[newTreeType].qualifiersEnabled && TREE_TYPE_CONFIGS[newTreeType].qualifiers && newTreeType !== "family" && (
                    <div className="pt-1 border-t border-border">
                      <p className="text-xs text-muted-foreground mb-1.5">
                        <strong>{TREE_TYPE_CONFIGS[newTreeType].qualifierLabel || "Qualifiers"}</strong> — extra detail you can tag on each relationship
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {TREE_TYPE_CONFIGS[newTreeType].qualifiers!.map((q) => (
                          <span key={q.value} className="inline-flex px-2 py-0.5 rounded bg-background border border-border text-[11px] text-muted-foreground">
                            {q.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tree-name">Tree Name</Label>
                  <Input
                    id="tree-name"
                    placeholder={newTreeType === "family" ? "e.g., Smith Family Tree" : `e.g., ${TREE_TYPE_CONFIGS[newTreeType].label}`}
                    value={newTreeName}
                    onChange={(e) => setNewTreeName(e.target.value)}
                    data-testid="input-tree-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tree-description">Description (optional)</Label>
                  <Textarea
                    id="tree-description"
                    placeholder={`Add a description for your ${TREE_TYPE_CONFIGS[newTreeType].label.toLowerCase()}...`}
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
                <div className="space-y-2">
                  <Label>Add yourself as the first member</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setCreatorProfileMode("full")}
                      className={`p-3 rounded-lg border text-left text-sm transition-colors ${
                        creatorProfileMode === "full" 
                          ? "border-primary bg-primary/10 text-primary" 
                          : "border-border hover:border-muted-foreground/50"
                      }`}
                      data-testid="button-profile-full"
                    >
                      <span className="font-medium block">Full profile</span>
                      <span className="text-xs text-muted-foreground">Name, email, photo & all details</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreatorProfileMode("basic")}
                      className={`p-3 rounded-lg border text-left text-sm transition-colors ${
                        creatorProfileMode === "basic" 
                          ? "border-primary bg-primary/10 text-primary" 
                          : "border-border hover:border-muted-foreground/50"
                      }`}
                      data-testid="button-profile-basic"
                    >
                      <span className="font-medium block">Just the basics</span>
                      <span className="text-xs text-muted-foreground">Name & email only, fill in the rest later</span>
                    </button>
                  </div>
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

        {/* Revenue Forecast Section (Admin Only) */}
        {isAdmin && (
          <div className="mb-8">
            <RevenueForecastSection />
          </div>
        )}

        {/* Member Credits & Pricing Card - always show for authenticated users */}
        <Card className="mb-8" data-testid="card-credit-balance">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Package className="h-5 w-5 text-primary" />
              Member Credits
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pricingLoading && !pricingStatus ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="space-y-1">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-8 w-12" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Total Members</p>
                  <p className="text-2xl font-bold" data-testid="text-total-members">{totalMembers}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Free Slots Left</p>
                  <p className="text-2xl font-bold" data-testid="text-free-remaining">{freeRemaining}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Credits Owned</p>
                  <p className="text-2xl font-bold" data-testid="text-credits-owned">{memberCredits}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Added This Month</p>
                  <div className="flex items-center gap-2">
                    <p className="text-2xl font-bold" data-testid="text-monthly-adds">{monthlyAdds}</p>
                    {monthlyAdds >= rewardThreshold && (
                      <span className="text-xs text-primary font-medium">20% off next pack</span>
                    )}
                  </div>
                </div>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="gap-2" data-testid="button-buy-credits">
                    <CreditCard className="h-4 w-4" />
                    Buy Member Pack
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {(pricingStatus?.config?.packs || [
                    { type: 'starter_10', credits: 10, priceCents: 799, label: 'Starter Pack' },
                    { type: 'growth_25', credits: 25, priceCents: 1499, label: 'Growth Pack' },
                    { type: 'family_50', credits: 50, priceCents: 2499, label: 'Family Pack' },
                  ]).map((pack) => (
                    <DropdownMenuItem
                      key={pack.type}
                      onClick={() => bulkPackMutation.mutate(pack.type)}
                      disabled={bulkPackMutation.isPending}
                      data-testid={`menu-pack-${pack.type}`}
                    >
                      <div className="flex items-center justify-between w-full gap-4">
                        <span className="font-medium">{pack.label}</span>
                        <span className="text-muted-foreground">
                          {pack.credits} credits &middot; ${(pack.priceCents / 100).toFixed(2)}
                        </span>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="outline" onClick={() => navigate("/pricing")} data-testid="button-view-pricing">
                View All Plans
              </Button>
              {pricingStatus?.hasActiveReward && (
                <span className="flex items-center gap-1 text-sm text-primary font-medium">
                  <Award className="h-4 w-4" />
                  {pricingStatus.activeRewardDiscount}% discount available
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Pending Family Connection Requests Section */}
        <div className="mb-8">
          <PendingConnectionsSection />
        </div>

        {/* My Family Connections Section */}
        <div className="mb-8">
          <MyConnectionsSection />
        </div>

        {/* Connect Trees Section - Show when connected users have trees */}
        <div className="mb-8">
          <ConnectTreesSection />
        </div>

        {/* Network Connection Requests Section - Extended family discovered via network */}
        <div className="mb-8">
          <NetworkRequestsSection />
        </div>

        {/* Pending Profile Claims Section */}
        <div className="mb-8">
          <PendingClaimsSection />
        </div>

        {/* Pending Custodianship Requests Section */}
        <div className="mb-8">
          <PendingCustodianshipSection />
        </div>

        {/* Potential Family Connections / Cross-Tree Matches */}
        <div className="mb-8">
          <PendingMatchesSection />
        </div>

        {/* Referral & Invite Section */}
        <div className="mb-8 space-y-6">
          <ReferralSection />
          
          {/* Invite Family Section */}
          <div className="grid md:grid-cols-2 gap-6">
            <EmailInviteForm referralCode={referralData?.referralCode} />
            <SocialShareButtons 
              shareUrl={referralData?.referralLink || `https://${window.location.hostname}`}
              title="Join me on FamilyRoots!"
              description="Build and explore your family tree with me on FamilyRoots - a beautiful way to preserve family history."
            />
          </div>
          
          <InviteTemplates 
            referralLink={referralData?.referralLink || `https://${window.location.hostname}`}
            userName={user?.firstName || undefined}
          />
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
                    <CardDescription className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                        tree.privacy === "private" 
                          ? "bg-muted text-muted-foreground" 
                          : "bg-primary/10 text-primary"
                      }`}>
                        {tree.privacy === "private" ? "Private" : "Public"}
                      </span>
                      {tree.treeType && tree.treeType !== "family" && (() => {
                        const TreeIcon = treeTypeIcons[(tree.treeType as TreeType) || "family"];
                        const config = TREE_TYPE_CONFIGS[(tree.treeType as TreeType) || "family"];
                        return (
                          <Badge variant="secondary" className="text-xs gap-1">
                            <TreeIcon className="h-3 w-3" />
                            {config.label}
                          </Badge>
                        );
                      })()}
                      {tree.parentTreeId && (() => {
                        const parentTree = trees?.find((t: any) => t.id === tree.parentTreeId);
                        return parentTree ? (
                          <Badge variant="outline" className="text-xs gap-1">
                            <GitBranch className="h-3 w-3" />
                            {parentTree.name}
                          </Badge>
                        ) : null;
                      })()}
                    </CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" data-testid={`button-tree-menu-${tree.id}`}>
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
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                    {tree.description || "No description"}
                  </p>
                  {tree.tags && tree.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3" data-testid={`tree-tags-${tree.id}`}>
                      {tree.tags.map((tag: any) => (
                        <Badge
                          key={tag.id}
                          variant="outline"
                          className="text-xs px-1.5 py-0"
                          style={{ borderColor: tag.color || "#6366f1", color: tag.color || "#6366f1" }}
                        >
                          {tag.label}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      <span>{tree.memberCount ?? 0} {(tree.memberCount ?? 0) === 1 ? TREE_TYPE_CONFIGS[(tree.treeType as TreeType) || "family"].memberLabel.toLowerCase() : TREE_TYPE_CONFIGS[(tree.treeType as TreeType) || "family"].membersLabel.toLowerCase()}</span>
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

        {/* Recently Deleted Section */}
        {deletedTrees && deletedTrees.length > 0 && (
          <div className="mt-8" data-testid="section-recently-deleted">
            <button
              onClick={() => setShowDeletedTrees(!showDeletedTrees)}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4"
              data-testid="button-toggle-deleted"
            >
              <Trash2 className="h-4 w-4" />
              <span className="text-sm font-medium">Recently Deleted ({deletedTrees.length})</span>
              <span className={`text-xs transition-transform ${showDeletedTrees ? "rotate-180" : ""}`}>▼</span>
            </button>

            {showDeletedTrees && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Items are permanently deleted after 30 days
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {deletedTrees.map((tree) => {
                    const deletedDate = tree.deletedAt ? new Date(tree.deletedAt) : new Date();
                    const daysLeft = Math.max(0, 30 - Math.floor((Date.now() - deletedDate.getTime()) / (1000 * 60 * 60 * 24)));
                    return (
                      <Card key={tree.id} className="border-dashed opacity-75 hover:opacity-100 transition-opacity" data-testid={`card-deleted-tree-${tree.id}`}>
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <CardTitle className="font-serif text-base truncate text-muted-foreground">{tree.name}</CardTitle>
                              <CardDescription className="text-xs mt-1">
                                Deleted {deletedDate.toLocaleDateString()} · {daysLeft} days left
                              </CardDescription>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="flex flex-col sm:flex-row gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 gap-1.5"
                              onClick={() => restoreTreeMutation.mutate(tree.id)}
                              disabled={restoreTreeMutation.isPending}
                              data-testid={`button-restore-tree-${tree.id}`}
                            >
                              <Undo2 className="h-3.5 w-3.5" />
                              Restore
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="flex-1 gap-1.5 text-destructive hover:text-destructive"
                              onClick={() => {
                                if (confirm("Permanently delete this tree? This cannot be undone and all data will be lost forever.")) {
                                  permanentDeleteTreeMutation.mutate(tree.id);
                                }
                              }}
                              disabled={permanentDeleteTreeMutation.isPending}
                              data-testid={`button-permanent-delete-tree-${tree.id}`}
                            >
                              <AlertTriangle className="h-3.5 w-3.5" />
                              Delete Forever
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
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
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-base font-medium">Tree Privacy</Label>
                <p className="text-sm text-muted-foreground">
                  Control who can discover and view your family tree.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={settingsPrivacy === "private" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setSettingsPrivacy("private")}
                  data-testid="button-privacy-private"
                >
                  Private
                </Button>
                <Button
                  type="button"
                  variant={settingsPrivacy === "public" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setSettingsPrivacy("public")}
                  data-testid="button-privacy-public"
                >
                  Public
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {settingsPrivacy === "private" 
                  ? "Only you and invited collaborators can see this tree."
                  : "Anyone with the link can view this tree (based on visibility settings below)."}
              </p>
            </div>

            <div className="border-t pt-4 space-y-2">
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
        type="credits"
        current={paymentGateInfo.current}
        credits={paymentGateInfo.credits}
      />
    </div>
  );
}
