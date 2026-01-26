import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/theme-toggle";
import { SEO } from "@/components/seo";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { trackAddFamilyMember } from "@/lib/tracking";
import { 
  Trees, Plus, Search, ArrowLeft, ZoomIn, ZoomOut, Maximize2, 
  Users, Calendar, MapPin, Heart, User, Edit, Trash2, Share2,
  ChevronRight, ChevronDown, ChevronUp, Filter, Download, Upload, Clock, Star, Image,
  Menu, ShoppingBag, Gift, QrCode, LayoutDashboard, ClipboardList, RefreshCw, Link2, Merge, Target
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toPng } from "html-to-image";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import type { FamilyTree, FamilyMember, Relationship, InsertFamilyMember } from "@shared/schema";
import FamilyTreeVisualization from "@/components/family-tree-visualization";
import MemberForm from "@/components/member-form";
import { NameHistorySection } from "@/components/name-history";
import { MemberDiscoverability } from "@/components/member-discoverability";
import { MatchRequests } from "@/components/match-requests";
import { InvitationStatus } from "@/components/invitation-status";
import { EducationHistorySection } from "@/components/education-history";
import { CareerHistorySection } from "@/components/career-history";
import { ShareTreeDialog } from "@/components/share-tree-dialog";
import TimelineView from "@/components/timeline-view";
import { RelationshipDisplay, FocusMemberSelector } from "@/components/relationship-display";
import { AddRelationship } from "@/components/add-relationship";
import { ProfileClaimSection } from "@/components/profile-claim-section";
import { LifeEventsSection } from "@/components/life-events-section";
import { CustodianshipSection } from "@/components/custodianship-section";
import { SpecialConnectionsSection, LocationSection } from "@/components/special-connections";
import { PaymentGateDialog } from "@/components/payment-gate-dialog";
import { BranchImportDialog } from "@/components/branch-import-dialog";
import { MergeMembersDialog } from "@/components/merge-members-dialog";

interface TreeData {
  tree: FamilyTree;
  members: FamilyMember[];
  relationships: Relationship[];
}

export default function TreeView() {
  const [, params] = useRoute("/tree/:id");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("tree");
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const [focusMemberId, setFocusMemberId] = useState<string | null>(null);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [isMemberDetailOpen, setIsMemberDetailOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  // Auto-adjust initial zoom for mobile screens
  const getInitialZoom = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      return 0.6; // Start zoomed out on mobile for better overview
    }
    return 1;
  };
  const [zoom, setZoom] = useState(getInitialZoom);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [newTreeName, setNewTreeName] = useState("");
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isEditMemberOpen, setIsEditMemberOpen] = useState(false);
  const [showPaymentGate, setShowPaymentGate] = useState(false);
  const [paymentGateInfo, setPaymentGateInfo] = useState<{ limit: number; current: number }>({ limit: 20, current: 20 });
  const [isExporting, setIsExporting] = useState(false);
  const [editingRelationship, setEditingRelationship] = useState<{ id: string; currentType: string; member1Name: string; member2Name: string; member1Id: string; member2Id: string } | null>(null);
  const [newRelationshipType, setNewRelationshipType] = useState<string>("");
  const [showMergedView, setShowMergedView] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [isMergeDialogOpen, setIsMergeDialogOpen] = useState(false);
  const [isFocusPanelCollapsed, setIsFocusPanelCollapsed] = useState(false);
  const [viewDepth, setViewDepth] = useState<'immediate' | 'extended' | 'all'>('all');
  const [importConnectionData, setImportConnectionData] = useState<{
    connectionId: string;
    connectorMemberId: string;
    sourceTreeName: string;
  } | null>(null);
  const treeContainerRef = useRef<HTMLDivElement>(null);

  const treeId = params?.id;

  const { data: treeData, isLoading, error } = useQuery<TreeData>({
    queryKey: ["/api/trees", treeId],
    enabled: !!treeId,
  });

  // Fetch merged tree data (connected trees combined)
  interface MergedTreeData {
    mainTree: FamilyTree;
    connections: Array<{
      id: string;
      tree1Id: string;
      tree2Id: string;
      connector1MemberId: string | null;
      connector2MemberId: string | null;
      connectionType: string;
    }>;
    members: Array<FamilyMember & { sourceTreeId: string; sourceTreeName: string; isFromConnectedTree: boolean }>;
    relationships: Relationship[];
    connectedTrees: Array<{ id: string; name: string; isMainTree: boolean }>;
  }

  const { data: mergedData, isLoading: isMergedLoading } = useQuery<MergedTreeData>({
    queryKey: ["/api/trees", treeId, "merged"],
    enabled: !!treeId && showMergedView,
  });

  // Determine which data to use based on merged view toggle
  const displayMembers = showMergedView && mergedData ? mergedData.members : (treeData?.members || []);
  const displayRelationships = showMergedView && mergedData ? mergedData.relationships : (treeData?.relationships || []);
  const hasConnections = mergedData?.connections && mergedData.connections.length > 0;

  // Derive focusMember from ID for stable state across re-renders
  // Use displayMembers to support both normal and merged view
  const focusMember = useMemo(() => {
    if (!focusMemberId) return null;
    const membersToSearch = showMergedView && mergedData?.members ? mergedData.members : treeData?.members;
    if (!membersToSearch) return null;
    return membersToSearch.find(m => m.id === focusMemberId) || null;
  }, [focusMemberId, treeData?.members, showMergedView, mergedData?.members]);

  // Auto-focus on viewing user's member, or root member when tree loads
  useEffect(() => {
    if (!focusMemberId && treeData?.members && user) {
      // Priority 1: Find user's claimed member in this tree
      const claimedMember = treeData.members.find(m => m.claimedByUserId === user.id);
      if (claimedMember) {
        setFocusMemberId(claimedMember.id);
        return;
      }
      
      // Priority 2: For tree owners, find member matching their email
      if (treeData.tree?.ownerId === user.id && user.email) {
        const ownerMember = treeData.members.find(m => 
          m.email?.toLowerCase() === user.email?.toLowerCase()
        );
        if (ownerMember) {
          setFocusMemberId(ownerMember.id);
          return;
        }
      }
      
      // Priority 3: Find member matching user's name (for owners)
      if (treeData.tree?.ownerId === user.id && user.firstName) {
        const nameMember = treeData.members.find(m => 
          m.firstName?.toLowerCase() === user.firstName?.toLowerCase() &&
          (!user.lastName || m.lastName?.toLowerCase() === user.lastName?.toLowerCase())
        );
        if (nameMember) {
          setFocusMemberId(nameMember.id);
          return;
        }
      }
    }
    // Fall back to root member
    if (treeData?.tree?.rootMemberId && !focusMemberId) {
      setFocusMemberId(treeData.tree.rootMemberId);
    }
  }, [treeData?.tree?.rootMemberId, treeData?.tree?.ownerId, treeData?.members, user?.id, user?.email, user?.firstName, user?.lastName, focusMemberId]);

  // Query collaborator status
  const { data: collaborators } = useQuery<Array<{userId: string; role: string}>>({
    queryKey: ["/api/trees", treeId, "collaborators"],
    enabled: !!treeId,
  });

  const userId = user?.id;
  const isOwner = treeData?.tree?.ownerId === userId;
  
  // Check if user is a collaborator with edit permissions
  const userCollaboration = collaborators?.find(c => c.userId === userId);
  const isCoOwner = userCollaboration?.role === "co_owner";
  const isEditor = userCollaboration?.role === "editor";
  const canEditTree = isOwner || isCoOwner || isEditor;
  
  // Check if user has claimed the selected member (can edit their own profile)
  const isClaimedOwnerOfSelectedMember = selectedMember?.claimedByUserId === userId;
  
  // Check if user is custodian of the selected member (can edit deceased member's profile)
  const isCustodianOfSelectedMember = selectedMember?.custodianUserId === userId;
  
  // Combined edit permission - tree editors OR profile owner OR custodian
  const canEdit = canEditTree || isClaimedOwnerOfSelectedMember || isCustodianOfSelectedMember;

  const addMemberMutation = useMutation({
    mutationFn: async (data: InsertFamilyMember) => {
      const res = await fetch(`/api/trees/${treeId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const errorData = await res.json();
        if (res.status === 402 && errorData.code === "FREE_TIER_MEMBER_LIMIT") {
          throw { isPaymentGate: true, ...errorData };
        }
        throw new Error(errorData.message || "Failed to add member");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trees", treeId] });
      setIsAddMemberOpen(false);
      trackAddFamilyMember();
      toast({
        title: "Success",
        description: "Family member added successfully!",
      });
    },
    onError: (error: any) => {
      if (error.isPaymentGate) {
        setIsAddMemberOpen(false);
        setPaymentGateInfo({ limit: error.limit, current: error.current });
        setShowPaymentGate(true);
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to add family member",
          variant: "destructive",
        });
      }
    },
  });

  const deleteMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      return apiRequest("DELETE", `/api/trees/${treeId}/members/${memberId}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trees", treeId] });
      setIsMemberDetailOpen(false);
      setSelectedMember(null);
      toast({
        title: "Success",
        description: "Family member removed",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove family member",
        variant: "destructive",
      });
    },
  });

  const updateMemberMutation = useMutation({
    mutationFn: async (data: { memberId: string; updates: Partial<InsertFamilyMember> }): Promise<FamilyMember> => {
      const response = await apiRequest("PATCH", `/api/trees/${treeId}/members/${data.memberId}`, data.updates);
      return response.json();
    },
    onSuccess: (updatedMember: FamilyMember) => {
      queryClient.invalidateQueries({ queryKey: ["/api/trees", treeId] });
      setIsEditMemberOpen(false);
      setSelectedMember(updatedMember);
      setTimeout(() => setIsMemberDetailOpen(true), 100);
      toast({
        title: "Success",
        description: "Family member updated",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update family member",
        variant: "destructive",
      });
    },
  });

  const renameTreeMutation = useMutation({
    mutationFn: async (name: string) => {
      return apiRequest("PATCH", `/api/trees/${treeId}`, { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trees", treeId] });
      setIsRenameOpen(false);
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

  const setRootMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      return apiRequest("PATCH", `/api/trees/${treeId}`, { rootMemberId: memberId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trees", treeId] });
      toast({
        title: "Success",
        description: "Root member set! This person will be the default focus when opening the tree.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to set root member",
        variant: "destructive",
      });
    },
  });

  const deleteRelationshipMutation = useMutation({
    mutationFn: async (relationshipId: string) => {
      return apiRequest("DELETE", `/api/trees/${treeId}/relationships/${relationshipId}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trees", treeId] });
      toast({
        title: "Success",
        description: "Relationship removed",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove relationship",
        variant: "destructive",
      });
    },
  });

  const updateRelationshipMutation = useMutation({
    mutationFn: async ({ oldRelationshipId, fromMemberId, toMemberId, newType }: { oldRelationshipId: string; fromMemberId: string; toMemberId: string; newType: string }) => {
      // Delete the old relationship first
      await apiRequest("DELETE", `/api/trees/${treeId}/relationships/${oldRelationshipId}`, undefined);
      // Create the new relationship
      return apiRequest("POST", `/api/trees/${treeId}/relationships`, {
        fromMemberId,
        toMemberId,
        relationshipType: newType,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trees", treeId] });
      setEditingRelationship(null);
      setNewRelationshipType("");
      toast({
        title: "Success",
        description: "Relationship updated",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update relationship",
        variant: "destructive",
      });
    },
  });

  const handleRenameOpen = () => {
    setNewTreeName(treeData?.tree.name || "");
    setIsRenameOpen(true);
  };

  const handleRenameSubmit = () => {
    if (newTreeName.trim()) {
      renameTreeMutation.mutate(newTreeName.trim());
    }
  };

  const deleteTreeMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/trees/${treeId}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trees"] });
      toast({
        title: "Success",
        description: "Tree deleted successfully",
      });
      navigate("/dashboard");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete tree",
        variant: "destructive",
      });
    },
  });

  const handleDeleteTree = () => {
    if (confirm("Are you sure you want to delete this tree? This action cannot be undone.")) {
      deleteTreeMutation.mutate();
    }
  };

  const handleExportImage = async () => {
    if (!treeContainerRef.current) {
      toast({
        title: "Export Error",
        description: "Tree visualization not found",
        variant: "destructive",
      });
      return;
    }

    setIsExporting(true);
    try {
      const isDarkMode = document.documentElement.classList.contains('dark');
      const backgroundColor = isDarkMode ? '#1a1a1a' : '#ffffff';
      
      const dataUrl = await toPng(treeContainerRef.current, {
        backgroundColor,
        quality: 1.0,
        pixelRatio: 2,
        cacheBust: true,
      });

      const link = document.createElement('a');
      link.download = `${treeData?.tree.name || 'family-tree'}-${new Date().toISOString().split('T')[0]}.png`;
      link.href = dataUrl;
      link.click();

      toast({
        title: "Success",
        description: "Family tree exported as image",
      });
    } catch (err) {
      console.error('Export failed:', err);
      toast({
        title: "Export Failed",
        description: "Could not export the family tree. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleMemberClick = (member: FamilyMember) => {
    setSelectedMember(member);
    setIsMemberDetailOpen(true);
  };

  const filteredMembers = treeData?.members?.filter(member =>
    `${member.firstName} ${member.lastName || ""}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    member.birthPlace?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md text-center">
          <CardContent className="pt-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
              <Trees className="h-8 w-8 text-destructive" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Tree Not Found</h3>
            <p className="text-muted-foreground mb-4">
              This family tree doesn't exist or you don't have access to it.
            </p>
            <Button onClick={() => navigate("/")} data-testid="button-back-home">
              Go Back Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const treeName = treeData?.tree?.name || "Family Tree";
  const memberCount = treeData?.members?.length || 0;

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      <SEO
        title={`${treeName} - FamilyRoots`}
        description={`Explore and manage ${treeName} with ${memberCount} family members. Add members, define relationships, and visualize your family history.`}
        keywords="family tree, genealogy, ancestry, family members, relationships"
      />
      <header className="sticky top-0 z-50 backdrop-blur-md bg-background/80 border-b border-border">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate("/")}
              data-testid="button-back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              {isLoading ? (
                <Skeleton className="h-6 w-40" />
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <h1 className="font-serif text-lg font-semibold">{treeData?.tree.name}</h1>
                    {(isOwner || isCoOwner) && (
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={handleRenameOpen}
                        data-testid="button-rename-tree"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {treeData?.tree.privacy}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {treeData?.members?.length || 0} members
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search members..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-64"
                data-testid="input-search-members"
              />
            </div>
            {(isOwner || isCoOwner) && (
              <Button 
                variant="outline" 
                size="icon" 
                onClick={() => setIsShareOpen(true)}
                data-testid="button-share"
              >
                <Share2 className="h-4 w-4" />
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" data-testid="button-more-options">
                  <Filter className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem 
                  className="gap-2" 
                  onClick={handleExportImage}
                  disabled={isExporting}
                  data-testid="button-export-image"
                >
                  <Image className="h-4 w-4" />
                  {isExporting ? "Exporting..." : "Export as Image"}
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2">
                  <Download className="h-4 w-4" />
                  Export GEDCOM
                </DropdownMenuItem>
                {canEditTree && (
                  <DropdownMenuItem className="gap-2">
                    <Upload className="h-4 w-4" />
                    Import GEDCOM
                  </DropdownMenuItem>
                )}
                {(isOwner || isCoOwner) && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      className="gap-2"
                      onClick={() => navigate("/manage-relationships")}
                      data-testid="button-manage-relationships"
                    >
                      <Link2 className="h-4 w-4" />
                      Manage Relationships
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className="gap-2 text-destructive"
                      onClick={handleDeleteTree}
                      data-testid="button-delete-tree"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete Tree
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  className="gap-2"
                  onClick={() => navigate("/")}
                  data-testid="menu-dashboard"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="flex items-start gap-2"
                  onClick={() => navigate("/merchandise")}
                  data-testid="menu-shop"
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
                  data-testid="menu-gifts"
                >
                  <Gift className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-medium">Browse Gift Ideas</div>
                    <div className="text-xs text-muted-foreground">Pre-made items from Amazon</div>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="flex items-start gap-2"
                  onClick={() => navigate(`/tree/${treeId}/registries`)}
                  data-testid="menu-gift-registries"
                >
                  <ClipboardList className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-medium">Gift Registries</div>
                    <div className="text-xs text-muted-foreground">Create wishlists for birthdays, showers</div>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="gap-2"
                  onClick={() => navigate("/share")}
                  data-testid="menu-share-app"
                >
                  <QrCode className="h-4 w-4" />
                  Share App
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <ThemeToggle />
            {canEditTree && (
              <Dialog open={isAddMemberOpen} onOpenChange={setIsAddMemberOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2" data-testid="button-add-member">
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">Add Member</span>
                  </Button>
                </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="font-serif">Add Family Member</DialogTitle>
                </DialogHeader>
                <MemberForm 
                  treeId={treeId!}
                  onSubmit={(data) => addMemberMutation.mutate(data)}
                  isLoading={addMemberMutation.isPending}
                />
              </DialogContent>
              </Dialog>
            )}

            <Dialog open={isRenameOpen} onOpenChange={(open) => {
              setIsRenameOpen(open);
              if (!open) setNewTreeName("");
            }}>
              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <DialogTitle className="font-serif">Rename Tree</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="tree-name">Tree Name</Label>
                    <Input
                      id="tree-name"
                      value={newTreeName}
                      onChange={(e) => setNewTreeName(e.target.value)}
                      placeholder="Enter tree name"
                      data-testid="input-tree-name"
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
                      onClick={() => setIsRenameOpen(false)}
                      data-testid="button-cancel-rename"
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleRenameSubmit}
                      disabled={!newTreeName.trim() || renameTreeMutation.isPending}
                      data-testid="button-save-rename"
                    >
                      {renameTreeMutation.isPending ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <div className="flex-1 flex">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <div className="border-b border-border bg-card/50">
            <div className="container mx-auto px-4">
              <TabsList className="bg-transparent h-12 p-0 gap-4">
                <TabsTrigger 
                  value="tree" 
                  className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-12 gap-2"
                  data-testid="tab-tree"
                >
                  <Trees className="h-4 w-4" />
                  Tree View
                </TabsTrigger>
                <TabsTrigger 
                  value="members" 
                  className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-12 gap-2"
                  data-testid="tab-members"
                >
                  <Users className="h-4 w-4" />
                  Members
                </TabsTrigger>
                <TabsTrigger 
                  value="timeline" 
                  className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-12 gap-2"
                  data-testid="tab-timeline"
                >
                  <Clock className="h-4 w-4" />
                  Timeline
                </TabsTrigger>
              </TabsList>
            </div>
          </div>

          <TabsContent value="tree" className="flex-1 m-0 relative overflow-hidden">
            {isLoading || (showMergedView && isMergedLoading) ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Trees className="h-12 w-12 text-muted-foreground mx-auto mb-4 animate-pulse" />
                  <p className="text-muted-foreground">
                    {showMergedView ? "Loading connected trees..." : "Loading family tree..."}
                  </p>
                </div>
              </div>
            ) : displayMembers.length > 0 ? (
              <>
                {/* Focus Member Selector and Merged View Toggle - Collapsible on mobile */}
                <div className="absolute top-2 left-2 sm:top-4 sm:left-4 z-10 bg-background/95 backdrop-blur rounded-lg shadow-lg border max-w-[calc(100vw-5rem)] sm:max-w-xs" data-testid="focus-selector-container">
                  {/* Collapsed header bar - always visible */}
                  <button
                    onClick={() => setIsFocusPanelCollapsed(!isFocusPanelCollapsed)}
                    className="w-full flex items-center justify-between p-2 sm:p-3 gap-2 hover-elevate rounded-lg"
                    data-testid="button-toggle-focus-panel"
                    aria-expanded={!isFocusPanelCollapsed}
                    aria-label={isFocusPanelCollapsed ? "Expand focus panel" : "Collapse focus panel"}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Target className="h-4 w-4 shrink-0 text-primary" />
                      <span className="text-sm font-medium truncate">
                        {focusMember ? `${focusMember.firstName} ${focusMember.lastName || ''}${focusMember.suffix ? ` ${focusMember.suffix}` : ''}` : "Select Focus"}
                      </span>
                    </div>
                    {isFocusPanelCollapsed ? (
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                  </button>
                  
                  {/* Expandable content */}
                  {!isFocusPanelCollapsed && (
                    <div className="px-2 pb-2 sm:px-3 sm:pb-3 border-t">
                      <div className="pt-2">
                        <FocusMemberSelector
                          members={displayMembers}
                          focusMember={focusMember}
                          onSelectFocus={(member) => setFocusMemberId(member?.id || null)}
                        />
                      </div>
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                        <Switch
                          id="merged-view"
                          checked={showMergedView}
                          onCheckedChange={setShowMergedView}
                          data-testid="switch-merged-view"
                        />
                        <Label htmlFor="merged-view" className="text-xs sm:text-sm cursor-pointer flex items-center gap-1">
                          <Link2 className="h-3 w-3" />
                          <span className="hidden sm:inline">Show Connected Trees</span>
                          <span className="sm:hidden">Connected</span>
                        </Label>
                      </div>
                      {showMergedView && mergedData?.connectedTrees && mergedData.connectedTrees.length > 1 && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          <span className="font-medium">{mergedData.connectedTrees.length} trees:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {mergedData.connectedTrees.map(t => {
                              const connection = !t.isMainTree ? mergedData.connections.find(
                                c => c.tree1Id === t.id || c.tree2Id === t.id
                              ) : null;
                              const connectorMemberId = connection ? (
                                connection.tree1Id === treeId ? connection.connector2MemberId : connection.connector1MemberId
                              ) : null;
                              
                              return (
                                <div key={t.id} className="flex items-center gap-1">
                                  <Badge variant={t.isMainTree ? "default" : "secondary"} className="text-xs">
                                    {t.name}
                                  </Badge>
                                  {!t.isMainTree && connection && connectorMemberId && canEditTree && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-5 px-1 text-xs"
                                      onClick={() => {
                                        setImportConnectionData({
                                          connectionId: connection.id,
                                          connectorMemberId,
                                          sourceTreeName: t.name
                                        });
                                        setImportDialogOpen(true);
                                      }}
                                      data-testid={`button-import-${t.id}`}
                                    >
                                      Import
                                    </Button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {showMergedView && (!mergedData?.connections || mergedData.connections.length === 0) && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          No connected trees yet.
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <div ref={treeContainerRef} className="w-full h-full">
                  <FamilyTreeVisualization
                    members={displayMembers}
                    relationships={displayRelationships}
                    zoom={zoom}
                    onMemberClick={handleMemberClick}
                    focusMemberId={focusMemberId}
                    viewDepth={viewDepth}
                  />
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-4">
                {/* Empty state focus panel - simplified and collapsible */}
                <div className="absolute top-2 left-2 sm:top-4 sm:left-4 z-10 bg-background/95 backdrop-blur rounded-lg shadow-lg border max-w-[calc(100vw-5rem)] sm:max-w-xs" data-testid="focus-selector-container">
                  <button
                    onClick={() => setIsFocusPanelCollapsed(!isFocusPanelCollapsed)}
                    className="w-full flex items-center justify-between p-2 sm:p-3 gap-2 hover-elevate rounded-lg"
                    data-testid="button-toggle-focus-panel"
                    aria-expanded={!isFocusPanelCollapsed}
                    aria-label={isFocusPanelCollapsed ? "Expand connected trees panel" : "Collapse connected trees panel"}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Link2 className="h-4 w-4 shrink-0 text-primary" />
                      <span className="text-sm font-medium">Connected Trees</span>
                    </div>
                    {isFocusPanelCollapsed ? (
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                  </button>
                  
                  {!isFocusPanelCollapsed && (
                    <div className="px-2 pb-2 sm:px-3 sm:pb-3 border-t pt-2">
                      <div className="flex items-center gap-2">
                        <Switch
                          id="merged-view-empty"
                          checked={showMergedView}
                          onCheckedChange={setShowMergedView}
                          data-testid="switch-merged-view"
                        />
                        <Label htmlFor="merged-view-empty" className="text-xs sm:text-sm cursor-pointer flex items-center gap-1">
                          <span className="hidden sm:inline">Show Connected Trees</span>
                          <span className="sm:hidden">Show</span>
                        </Label>
                      </div>
                      {showMergedView && mergedData?.connectedTrees && mergedData.connectedTrees.length > 1 && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          <span className="font-medium">{mergedData.connectedTrees.length} trees:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {mergedData.connectedTrees.map(t => {
                              const connection = !t.isMainTree ? mergedData.connections.find(
                                c => c.tree1Id === t.id || c.tree2Id === t.id
                              ) : null;
                              const connectorMemberId = connection ? (
                                connection.tree1Id === treeId ? connection.connector2MemberId : connection.connector1MemberId
                              ) : null;
                              
                              return (
                                <div key={t.id} className="flex items-center gap-1">
                                  <Badge variant={t.isMainTree ? "default" : "secondary"} className="text-xs">
                                    {t.name}
                                  </Badge>
                                  {!t.isMainTree && connection && connectorMemberId && canEditTree && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-5 px-1 text-xs"
                                          onClick={() => {
                                            setImportConnectionData({
                                              connectionId: connection.id,
                                              connectorMemberId,
                                              sourceTreeName: t.name
                                            });
                                            setImportDialogOpen(true);
                                          }}
                                          data-testid={`button-import-${t.id}`}
                                        >
                                          Import
                                        </Button>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          {showMergedView && (!mergedData?.connections || mergedData.connections.length === 0) && (
                            <p className="mt-2 text-xs text-muted-foreground">
                              No connected trees yet.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                <Card className="max-w-md text-center">
                  <CardContent className="pt-6">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">Start Your Family Tree</h3>
                    <p className="text-muted-foreground mb-4">
                      Add your first family member to begin building your tree
                    </p>
                    <Button onClick={() => setIsAddMemberOpen(true)} className="gap-2" data-testid="button-add-first-member">
                      <Plus className="h-4 w-4" />
                      Add First Member
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="members" className="flex-1 m-0">
            <div className="container mx-auto px-4 py-6">
              {isLoading ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3, 4, 5, 6].map(i => (
                    <Card key={i}>
                      <CardContent className="p-4 flex items-center gap-4">
                        <Skeleton className="h-12 w-12 rounded-full" />
                        <div className="flex-1">
                          <Skeleton className="h-5 w-32 mb-2" />
                          <Skeleton className="h-4 w-24" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : filteredMembers.length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredMembers.map(member => (
                    <Card 
                      key={member.id} 
                      className="hover-elevate cursor-pointer"
                      onClick={() => handleMemberClick(member)}
                      data-testid={`card-member-${member.id}`}
                    >
                      <CardContent className="p-4 flex items-center gap-4">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={member.photoUrl || undefined} />
                          <AvatarFallback className="bg-primary/10 text-primary font-serif">
                            {member.firstName[0]}{member.lastName?.[0] || ""}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold truncate">
                            {member.firstName} {member.lastName || ""}{member.suffix ? ` ${member.suffix}` : ""}
                          </h3>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            {member.birthDate && (
                              <span>{new Date(member.birthDate).getFullYear()}</span>
                            )}
                            {member.birthDate && member.deathDate && <span>-</span>}
                            {member.deathDate && (
                              <span>{new Date(member.deathDate).getFullYear()}</span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : searchQuery ? (
                <div className="text-center py-12">
                  <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Results Found</h3>
                  <p className="text-muted-foreground">
                    No family members match your search
                  </p>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Members Yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Start adding family members to your tree
                  </p>
                  <Button onClick={() => setIsAddMemberOpen(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Member
                  </Button>
                </div>
              )}

              {/* Email Invitation Status - visible to tree owner/editors */}
              {treeData?.tree && canEditTree && (
                <div className="mt-6" data-testid="invitation-status-panel">
                  <InvitationStatus treeId={treeData.tree.id} />
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="timeline" className="flex-1 m-0">
            <TimelineView 
              members={treeData?.members || []} 
              treeId={treeId!}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Tree Controls - Fixed positioned outside overflow container */}
      {activeTab === 'tree' && displayMembers.length > 0 && (
        <>
          {/* View Depth Controls */}
          <div 
            className="fixed bottom-24 sm:bottom-4 right-2 sm:right-4 z-50 bg-background/90 backdrop-blur rounded-lg p-1.5 sm:p-2 shadow-lg border"
            role="group"
            aria-label="Family view depth controls"
          >
            <div className="flex flex-col gap-1.5 items-center">
              <span className="text-xs text-muted-foreground font-medium hidden sm:inline" id="view-depth-label">View Depth</span>
              <div className="flex flex-row gap-1" role="radiogroup" aria-labelledby="view-depth-label">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={viewDepth === 'immediate' ? 'default' : 'secondary'}
                      size="sm"
                      onClick={() => setViewDepth('immediate')}
                      data-testid="button-view-immediate"
                      aria-label="Core family view: parents, spouse, and children only"
                      aria-pressed={viewDepth === 'immediate'}
                    >
                      Core
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[200px]">
                    <p className="font-medium">Core Family</p>
                    <p className="text-xs text-muted-foreground">Parents, spouse, co-parents, and children</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={viewDepth === 'extended' ? 'default' : 'secondary'}
                      size="sm"
                      onClick={() => setViewDepth('extended')}
                      data-testid="button-view-extended"
                      aria-label="Extended family view: includes grandparents, grandchildren, and siblings"
                      aria-pressed={viewDepth === 'extended'}
                    >
                      Extended
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[220px]">
                    <p className="font-medium">Extended Family</p>
                    <p className="text-xs text-muted-foreground">+ Grandparents, grandchildren, siblings, aunts, and uncles</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={viewDepth === 'all' ? 'default' : 'secondary'}
                      size="sm"
                      onClick={() => setViewDepth('all')}
                      data-testid="button-view-all"
                      aria-label="All family view: includes in-laws, cousins, and extended family"
                      aria-pressed={viewDepth === 'all'}
                    >
                      All
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[220px]">
                    <p className="font-medium">Full Family Tree</p>
                    <p className="text-xs text-muted-foreground">+ Cousins, in-laws, and everyone in your tree</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>
          {/* Zoom Controls */}
          <div className="fixed bottom-24 sm:bottom-4 left-2 sm:left-4 flex flex-row gap-1 sm:gap-2 z-50 bg-background/90 backdrop-blur rounded-lg p-1.5 sm:p-2 shadow-lg border">
            <Button 
              variant="secondary" 
              size="icon" 
              onClick={() => setZoom(z => Math.max(z - 0.2, 0.4))}
              data-testid="button-zoom-out"
              className="h-10 w-10 sm:h-9 sm:w-9"
              aria-label="Zoom out"
            >
              <ZoomOut className="h-5 w-5 sm:h-4 sm:w-4" />
            </Button>
            <Button 
              variant="secondary" 
              size="icon" 
              onClick={() => setZoom(getInitialZoom())}
              data-testid="button-zoom-reset"
              className="h-10 w-10 sm:h-9 sm:w-9"
              aria-label="Reset zoom"
            >
              <Maximize2 className="h-5 w-5 sm:h-4 sm:w-4" />
            </Button>
            <Button 
              variant="secondary" 
              size="icon" 
              onClick={() => setZoom(z => Math.min(z + 0.2, 2))}
              data-testid="button-zoom-in"
              className="h-10 w-10 sm:h-9 sm:w-9"
              aria-label="Zoom in"
            >
              <ZoomIn className="h-5 w-5 sm:h-4 sm:w-4" />
            </Button>
          </div>
        </>
      )}

      <Sheet open={isMemberDetailOpen} onOpenChange={setIsMemberDetailOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedMember && (
            <>
              <SheetHeader className="mb-6">
                <div className="flex items-start gap-4">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={selectedMember.photoUrl || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary font-serif text-2xl">
                      {selectedMember.firstName[0]}{selectedMember.lastName?.[0] || ""}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <SheetTitle className="font-serif text-xl mb-1">
                      {selectedMember.firstName} {selectedMember.lastName || ""}{selectedMember.suffix ? ` ${selectedMember.suffix}` : ""}
                    </SheetTitle>
                    <div className="flex items-center gap-2 flex-wrap">
                      {selectedMember.gender && (
                        <Badge variant="secondary" className="capitalize">
                          {selectedMember.gender}
                        </Badge>
                      )}
                      {selectedMember.isLiving === false && (
                        <Badge variant="outline">Deceased</Badge>
                      )}
                      {selectedMember.claimedByUserId && (selectedMember as any)._profileSourceInfo && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="outline" className="text-primary border-primary/50 gap-1" data-testid="badge-profile-synced">
                              <RefreshCw className="h-3 w-3" />
                              Synced
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Personal data synced from claimed user's profile</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                      {selectedMember.claimedByUserId && !(selectedMember as any)._profileSourceInfo && (
                        <Badge variant="outline" className="text-green-600 border-green-600/50" data-testid="badge-profile-claimed">
                          Claimed
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </SheetHeader>

              {/* Prominent Relationship to Focus Person / Root Member */}
              {treeData && selectedMember && (() => {
                // Determine the "reference" person - the focus member or root member
                const referenceMemberId = focusMemberId || treeData.tree.rootMemberId;
                if (!referenceMemberId || referenceMemberId === selectedMember.id) return null;
                
                const referenceMember = treeData.members.find(m => m.id === referenceMemberId);
                if (!referenceMember) return null;
                
                // Find direct relationship between selectedMember and referenceMember
                const directRelationship = treeData.relationships.find(r => 
                  (r.fromMemberId === selectedMember.id && r.toMemberId === referenceMemberId) ||
                  (r.fromMemberId === referenceMemberId && r.toMemberId === selectedMember.id)
                );
                
                if (!directRelationship) return null;
                
                // Determine the relationship label from reference member's perspective
                let relationshipLabel = "";
                let description = "";
                
                if (directRelationship.relationshipType === "parent") {
                  if (directRelationship.fromMemberId === selectedMember.id) {
                    // selectedMember is parent of referenceMember - so selectedMember is "Your Parent"
                    const genderLabel = selectedMember.gender === "female" ? "Mother" : selectedMember.gender === "male" ? "Father" : "Parent";
                    relationshipLabel = `Your ${genderLabel}`;
                    description = `${selectedMember.firstName} is ${referenceMember.firstName}'s ${genderLabel.toLowerCase()}`;
                  } else {
                    // referenceMember is parent of selectedMember - so selectedMember is "Your Child"
                    const genderLabel = selectedMember.gender === "female" ? "Daughter" : selectedMember.gender === "male" ? "Son" : "Child";
                    relationshipLabel = `Your ${genderLabel}`;
                    description = `${selectedMember.firstName} is ${referenceMember.firstName}'s ${genderLabel.toLowerCase()}`;
                  }
                } else if (directRelationship.relationshipType === "spouse") {
                  relationshipLabel = "Your Spouse";
                  description = `${selectedMember.firstName} is ${referenceMember.firstName}'s spouse/partner`;
                } else if (directRelationship.relationshipType === "sibling") {
                  const genderLabel = selectedMember.gender === "female" ? "Sister" : selectedMember.gender === "male" ? "Brother" : "Sibling";
                  relationshipLabel = `Your ${genderLabel}`;
                  description = `${selectedMember.firstName} is ${referenceMember.firstName}'s ${genderLabel.toLowerCase()}`;
                } else if (directRelationship.relationshipType === "coparent") {
                  relationshipLabel = "Your Co-Parent";
                  description = `${selectedMember.firstName} shares a child with ${referenceMember.firstName}`;
                }
                
                if (!relationshipLabel) return null;
                
                return (
                  <div className="mb-4 p-3 bg-primary/5 rounded-lg border border-primary/20" data-testid="relationship-to-you-section">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Heart className="h-4 w-4 text-primary" />
                      <Badge variant="default" className="text-sm" data-testid="badge-relationship-to-you">
                        {relationshipLabel}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        (relative to {referenceMember.firstName})
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Relationship to focus person */}
              {focusMember && treeId && (
                <RelationshipDisplay
                  treeId={treeId}
                  focusMember={focusMember}
                  selectedMember={selectedMember}
                />
              )}

              <div className="space-y-6">
                {(selectedMember.birthDate || selectedMember.birthPlace) && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Birth</h4>
                    <div className="space-y-1">
                      {selectedMember.birthDate && (
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>{new Date(selectedMember.birthDate).toLocaleDateString('en-US', { 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })}</span>
                        </div>
                      )}
                      {selectedMember.birthPlace && (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span>{selectedMember.birthPlace}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {selectedMember.deathDate && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Death</h4>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>{new Date(selectedMember.deathDate).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}</span>
                    </div>
                  </div>
                )}

                {selectedMember.notes && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Notes</h4>
                    <p className="text-sm">{selectedMember.notes}</p>
                  </div>
                )}

                <NameHistorySection 
                  memberId={selectedMember.id} 
                  canEdit={canEdit}
                />

                <EducationHistorySection 
                  memberId={selectedMember.id} 
                  canEdit={canEdit}
                />

                <CareerHistorySection 
                  memberId={selectedMember.id} 
                  canEdit={canEdit}
                />

                <MemberDiscoverability 
                  member={selectedMember} 
                  canEdit={canEdit}
                />

                {/* Profile Claim Section */}
                <ProfileClaimSection 
                  member={selectedMember}
                  isOwner={treeData?.tree.ownerId === user?.id}
                />

                {/* Life Events Section */}
                {treeData && (
                  <LifeEventsSection
                    memberId={selectedMember.id}
                    treeId={treeData.tree.id}
                    canEdit={canEdit}
                    memberName={selectedMember.firstName + (selectedMember.lastName ? ` ${selectedMember.lastName}` : '') + (selectedMember.suffix ? ` ${selectedMember.suffix}` : '')}
                  />
                )}

                {/* Custodianship Section (for deceased members) */}
                {user && treeData && selectedMember.deathDate && (
                  <CustodianshipSection
                    member={selectedMember}
                    currentUserId={user.id}
                    isTreeOwner={treeData.tree.ownerId === user.id}
                  />
                )}

                {/* Special Connections Section */}
                {treeData && (
                  <SpecialConnectionsSection
                    memberId={selectedMember.id}
                    treeId={treeData.tree.id}
                    canEdit={canEdit}
                    allMembers={treeData.members}
                  />
                )}

                {/* Location Section */}
                {treeData && (
                  <LocationSection
                    member={selectedMember}
                    canEdit={canEdit}
                    onUpdate={async (updates) => {
                      await updateMemberMutation.mutateAsync({ memberId: selectedMember.id, updates });
                    }}
                  />
                )}

                {/* Existing Relationships Section */}
                {treeData && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                      <Link2 className="h-4 w-4" />
                      Family Relationships
                    </h4>
                    {(() => {
                      const memberRelationships = treeData.relationships.filter(
                        r => r.fromMemberId === selectedMember.id || r.toMemberId === selectedMember.id
                      );
                      if (memberRelationships.length === 0) {
                        return (
                          <p className="text-sm text-muted-foreground">
                            No relationships defined yet. Use the button below to add family connections.
                          </p>
                        );
                      }
                      const getMember = (id: string) => treeData.members.find(m => m.id === id);
                      const getMemberName = (m: FamilyMember | undefined) => m ? (m.lastName ? `${m.firstName} ${m.lastName}` : m.firstName) + (m.suffix ? ` ${m.suffix}` : '') : "Unknown";
                      
                      // Build list of individual relationships with their IDs
                      const relationshipItems: { id: string; label: string; personName: string; description: string; fromMemberId: string; toMemberId: string; relationshipType: string; otherMemberName: string }[] = [];
                      
                      // Parents (relationships where someone else is parent of selectedMember)
                      memberRelationships
                        .filter(r => r.toMemberId === selectedMember.id && r.relationshipType === "parent")
                        .forEach(r => {
                          const parent = getMember(r.fromMemberId);
                          if (parent) {
                            const label = parent.gender === "female" ? "Mother" : parent.gender === "male" ? "Father" : "Parent";
                            relationshipItems.push({
                              id: r.id,
                              label,
                              personName: getMemberName(parent),
                              description: `${getMemberName(parent)} is ${selectedMember.firstName}'s ${label.toLowerCase()}`,
                              fromMemberId: r.fromMemberId,
                              toMemberId: r.toMemberId,
                              relationshipType: r.relationshipType,
                              otherMemberName: getMemberName(parent)
                            });
                          }
                        });
                      
                      // Children (relationships where selectedMember is parent of someone)
                      memberRelationships
                        .filter(r => r.fromMemberId === selectedMember.id && r.relationshipType === "parent")
                        .forEach(r => {
                          const child = getMember(r.toMemberId);
                          if (child) {
                            const label = child.gender === "female" ? "Daughter" : child.gender === "male" ? "Son" : "Child";
                            relationshipItems.push({
                              id: r.id,
                              label,
                              personName: getMemberName(child),
                              description: `${getMemberName(child)} is ${selectedMember.firstName}'s ${label.toLowerCase()}`,
                              fromMemberId: r.fromMemberId,
                              toMemberId: r.toMemberId,
                              relationshipType: r.relationshipType,
                              otherMemberName: getMemberName(child)
                            });
                          }
                        });
                      
                      // Spouse/Partner
                      memberRelationships
                        .filter(r => r.relationshipType === "spouse")
                        .forEach(r => {
                          const spouse = getMember(r.fromMemberId === selectedMember.id ? r.toMemberId : r.fromMemberId);
                          if (spouse) {
                            relationshipItems.push({
                              id: r.id,
                              label: "Spouse",
                              personName: getMemberName(spouse),
                              description: `${getMemberName(spouse)} is ${selectedMember.firstName}'s spouse/partner`,
                              fromMemberId: r.fromMemberId,
                              toMemberId: r.toMemberId,
                              relationshipType: r.relationshipType,
                              otherMemberName: getMemberName(spouse)
                            });
                          }
                        });
                      
                      // Siblings
                      memberRelationships
                        .filter(r => r.relationshipType === "sibling")
                        .forEach(r => {
                          const sibling = getMember(r.fromMemberId === selectedMember.id ? r.toMemberId : r.fromMemberId);
                          if (sibling) {
                            const label = sibling.gender === "female" ? "Sister" : sibling.gender === "male" ? "Brother" : "Sibling";
                            relationshipItems.push({
                              id: r.id,
                              label,
                              personName: getMemberName(sibling),
                              description: `${getMemberName(sibling)} is ${selectedMember.firstName}'s ${label.toLowerCase()}`,
                              fromMemberId: r.fromMemberId,
                              toMemberId: r.toMemberId,
                              relationshipType: r.relationshipType,
                              otherMemberName: getMemberName(sibling)
                            });
                          }
                        });
                      
                      return (
                        <div className="space-y-2">
                          {relationshipItems.map((item) => (
                            <div key={item.id} className="flex items-center gap-2 justify-between p-2 rounded-md bg-muted/50" data-testid={`relationship-item-${item.id}`}>
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <Badge variant="outline" className="text-xs shrink-0">{item.label}</Badge>
                                <span className="text-sm truncate">{item.personName}</span>
                              </div>
                              {canEditTree && (
                                <div className="flex items-center gap-1">
                                  <Button 
                                    variant="ghost" 
                                    size="icon"
                                    onClick={() => {
                                      setEditingRelationship({
                                        id: item.id,
                                        currentType: item.relationshipType,
                                        member1Name: selectedMember.firstName,
                                        member2Name: item.otherMemberName,
                                        member1Id: item.fromMemberId,
                                        member2Id: item.toMemberId
                                      });
                                      setNewRelationshipType(item.relationshipType);
                                    }}
                                    data-testid={`button-edit-relationship-${item.id}`}
                                  >
                                    <Edit className="h-4 w-4 text-muted-foreground" />
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="icon"
                                    onClick={() => {
                                      if (confirm(`Remove this relationship? (${item.description})`)) {
                                        deleteRelationshipMutation.mutate(item.id);
                                      }
                                    }}
                                    disabled={deleteRelationshipMutation.isPending}
                                    data-testid={`button-delete-relationship-${item.id}`}
                                  >
                                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Add Relationship Button */}
                {canEditTree && treeData && (
                  <div className="pt-4 border-t border-border">
                    <AddRelationship
                      treeId={treeData.tree.id}
                      currentMember={selectedMember}
                      allMembers={treeData.members}
                      existingRelationships={treeData.relationships}
                      canEdit={canEditTree}
                    />
                  </div>
                )}

                <div className="flex gap-2 pt-4 border-t border-border flex-wrap">
                  <Button 
                    variant={focusMemberId === selectedMember.id ? "default" : "outline"} 
                    className="gap-2"
                    onClick={() => setFocusMemberId(focusMemberId === selectedMember.id ? null : selectedMember.id)}
                    data-testid="button-set-focus"
                  >
                    <User className="h-4 w-4" />
                    {focusMemberId === selectedMember.id ? "Focus Set" : "Set as Focus"}
                  </Button>
                  {canEditTree && (
                    <Button 
                      variant={treeData?.tree?.rootMemberId === selectedMember.id ? "default" : "outline"} 
                      className="gap-2"
                      onClick={() => setRootMemberMutation.mutate(selectedMember.id)}
                      disabled={setRootMemberMutation.isPending || treeData?.tree?.rootMemberId === selectedMember.id}
                      data-testid="button-set-root"
                    >
                      <Star className={`h-4 w-4 ${treeData?.tree?.rootMemberId === selectedMember.id ? "fill-current" : ""}`} />
                      {treeData?.tree?.rootMemberId === selectedMember.id ? "Main Person" : "Set as Main"}
                    </Button>
                  )}
                  {canEdit && (
                    <Button 
                      variant="outline" 
                      className="flex-1 gap-2" 
                      data-testid="button-edit-member"
                      onClick={() => {
                        setIsMemberDetailOpen(false);
                        setTimeout(() => setIsEditMemberOpen(true), 100);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                      Edit
                    </Button>
                  )}
                  {canEditTree && !selectedMember.claimedByUserId && (
                    <Button 
                      variant="outline" 
                      className="gap-2"
                      onClick={() => {
                        setIsMemberDetailOpen(false);
                        setTimeout(() => setIsMergeDialogOpen(true), 100);
                      }}
                      data-testid="button-merge-member"
                    >
                      <Merge className="h-4 w-4" />
                      Merge
                    </Button>
                  )}
                  {canEditTree && (
                    <Button 
                      variant="destructive" 
                      className="gap-2"
                      onClick={() => deleteMemberMutation.mutate(selectedMember.id)}
                      disabled={deleteMemberMutation.isPending}
                      data-testid="button-delete-member"
                    >
                      <Trash2 className="h-4 w-4" />
                      {deleteMemberMutation.isPending ? "Deleting..." : "Delete"}
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {treeData?.tree && (
        <ShareTreeDialog
          open={isShareOpen}
          onOpenChange={setIsShareOpen}
          treeId={treeData.tree.id}
          treeName={treeData.tree.name}
        />
      )}

      {/* Edit Member Dialog */}
      <Dialog open={isEditMemberOpen} onOpenChange={setIsEditMemberOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Family Member</DialogTitle>
          </DialogHeader>
          {selectedMember && treeData?.tree && (
            <MemberForm
              treeId={treeData.tree.id}
              initialData={{
                firstName: selectedMember.firstName,
                lastName: selectedMember.lastName || undefined,
                nickname: selectedMember.nickname || undefined,
                email: selectedMember.email || undefined,
                gender: selectedMember.gender || undefined,
                birthDate: selectedMember.birthDate || undefined,
                birthPlace: selectedMember.birthPlace || undefined,
                deathDate: selectedMember.deathDate || undefined,
                isLiving: selectedMember.isLiving ?? true,
                photoUrl: selectedMember.photoUrl || undefined,
                notes: selectedMember.notes || undefined,
              }}
              onSubmit={(data) => {
                updateMemberMutation.mutate({
                  memberId: selectedMember.id,
                  updates: data,
                });
              }}
              isLoading={updateMemberMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Match Requests Section - visible to tree owner/editors */}
      {treeData?.tree && canEditTree && (
        <div className="fixed bottom-4 right-4 z-40 w-80" data-testid="match-requests-panel">
          <MatchRequests treeId={treeData.tree.id} canEdit={canEditTree} />
        </div>
      )}

      {/* Edit Relationship Dialog */}
      <Dialog open={!!editingRelationship} onOpenChange={(open) => !open && setEditingRelationship(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Relationship</DialogTitle>
          </DialogHeader>
          {editingRelationship && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Change the relationship between {editingRelationship.member1Name} and {editingRelationship.member2Name}
              </p>
              <div className="space-y-2">
                <Label>Relationship Type</Label>
                <Select value={newRelationshipType} onValueChange={setNewRelationshipType}>
                  <SelectTrigger data-testid="select-new-relationship-type">
                    <SelectValue placeholder="Select relationship type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="parent">Parent/Child</SelectItem>
                    <SelectItem value="spouse">Spouse/Partner</SelectItem>
                    <SelectItem value="sibling">Sibling</SelectItem>
                    <SelectItem value="coparent">Co-Parent (shares child, not married)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Current: {editingRelationship.currentType}
                </p>
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setEditingRelationship(null)}
                  data-testid="button-cancel-edit-relationship"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (editingRelationship && newRelationshipType && newRelationshipType !== editingRelationship.currentType) {
                      updateRelationshipMutation.mutate({
                        oldRelationshipId: editingRelationship.id,
                        fromMemberId: editingRelationship.member1Id,
                        toMemberId: editingRelationship.member2Id,
                        newType: newRelationshipType,
                      });
                    }
                  }}
                  disabled={!newRelationshipType || newRelationshipType === editingRelationship.currentType || updateRelationshipMutation.isPending}
                  data-testid="button-save-relationship"
                >
                  {updateRelationshipMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <PaymentGateDialog
        open={showPaymentGate}
        onOpenChange={setShowPaymentGate}
        type="member"
        limit={paymentGateInfo.limit}
        current={paymentGateInfo.current}
      />

      {importConnectionData && treeId && (
        <BranchImportDialog
          isOpen={importDialogOpen}
          onClose={() => {
            setImportDialogOpen(false);
            setImportConnectionData(null);
          }}
          treeId={treeId}
          connectionId={importConnectionData.connectionId}
          connectorMemberId={importConnectionData.connectorMemberId}
          sourceTreeName={importConnectionData.sourceTreeName}
        />
      )}

      {selectedMember && treeData && (
        <MergeMembersDialog
          open={isMergeDialogOpen}
          onOpenChange={setIsMergeDialogOpen}
          sourceMember={selectedMember}
          allMembers={treeData.members}
          relationships={treeData.relationships}
          treeId={treeData.tree.id}
        />
      )}
    </div>
  );
}
