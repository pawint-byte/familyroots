import { useState, useEffect, useRef, useCallback, useMemo, type ReactNode } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { parseDateString } from "@/lib/utils";
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
  Menu, ShoppingBag, Gift, QrCode, LayoutDashboard, ClipboardList, RefreshCw, Link2, Merge, Target,
  LayoutGrid, CircleDot, Rows3, Network, Orbit, GitBranch, UserMinus, Globe, BellOff, Bell, Scissors,
  Mail, TreeDeciduous, Send, Tag, Undo2, ArrowLeftRight, UserPlus, BookHeart, BarChart3, Copy, Save,
  MessageSquare
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { toPng } from "html-to-image";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import type { FamilyTree, FamilyMember, Relationship, InsertFamilyMember, TreeTag, MemberTag } from "@shared/schema";
import FamilyTreeVisualization from "@/components/family-tree-visualization";
import GroupVisualization, { type GroupLayoutMode, type MemberUpcomingEvent } from "@/components/group-visualization";
import MemberForm from "@/components/member-form";
import { NameHistorySection } from "@/components/name-history";
import { MemberDiscoverability } from "@/components/member-discoverability";
import { MatchRequests } from "@/components/match-requests";
import SmartMatchDialog from "@/components/smart-match-dialog";
import { InvitationStatus } from "@/components/invitation-status";
import { EducationHistorySection } from "@/components/education-history";
import { CareerHistorySection } from "@/components/career-history";
import { ShareTreeDialog } from "@/components/share-tree-dialog";
import TimelineView from "@/components/timeline-view";
import { RelationshipDisplay, FocusMemberSelector } from "@/components/relationship-display";
import { AddRelationship } from "@/components/add-relationship";
import { getTreeTypeConfig, getRelationshipTypesForTree, getDefaultPeerRelationship, getDefaultLeaderRelationship, type TreeType } from "@shared/treeTypes";
import { ProfileClaimSection } from "@/components/profile-claim-section";
import { LifeEventsSection } from "@/components/life-events-section";
import { GiftRegistrySection } from "@/components/gift-registry-section";
import { CustodianshipSection } from "@/components/custodianship-section";
import { SpecialConnectionsSection, LocationSection } from "@/components/special-connections";
import { PaymentGateDialog } from "@/components/payment-gate-dialog";
import { BranchImportDialog } from "@/components/branch-import-dialog";
import { MemberPoolDialog } from "@/components/member-pool-dialog";
import { BulkUploadDialog } from "@/components/bulk-upload-dialog";
import { MergeMembersDialog } from "@/components/merge-members-dialog";
import { MemberMergeDialog } from "@/components/member-merge-dialog";
import { InviteConnectDialog } from "@/components/invite-connect-dialog";
import { MemoryLane } from "@/components/memory-lane";
import { TreeWall } from "@/components/tree-wall";
import { VoiceNotesSection } from "@/components/voice-notes-section";
import { AnnualTreeReport } from "@/components/annual-tree-report";
import { TreeRegistriesTab } from "@/components/tree-registries-tab";

interface TreeData {
  tree: FamilyTree;
  members: FamilyMember[];
  relationships: Relationship[];
  parentTree?: { id: string; name: string } | null;
  childTrees?: { id: string; name: string }[];
  tags?: TreeTag[];
  memberTags?: MemberTag[];
}

function ScrollableTabBar({ children, activeTab }: { children: ReactNode; activeTab: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [translateX, setTranslateX] = useState(0);
  const touchRef = useRef({ startX: 0, startTranslate: 0, isDragging: false, startTime: 0 });

  const getMaxScroll = useCallback(() => {
    if (!containerRef.current || !innerRef.current) return 0;
    const containerWidth = containerRef.current.offsetWidth;
    const contentWidth = innerRef.current.scrollWidth;
    return Math.max(0, contentWidth - containerWidth);
  }, []);

  const clamp = useCallback((val: number) => {
    const max = getMaxScroll();
    return Math.max(-max, Math.min(0, val));
  }, [getMaxScroll]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleTouchStart = (e: TouchEvent) => {
      touchRef.current.startX = e.touches[0].clientX;
      touchRef.current.startTranslate = translateX;
      touchRef.current.isDragging = false;
      touchRef.current.startTime = Date.now();
    };

    const handleTouchMove = (e: TouchEvent) => {
      const deltaX = e.touches[0].clientX - touchRef.current.startX;
      if (Math.abs(deltaX) > 5) {
        touchRef.current.isDragging = true;
        e.preventDefault();
        const newTranslate = clamp(touchRef.current.startTranslate + deltaX);
        setTranslateX(newTranslate);
      }
    };

    const handleTouchEnd = () => {
      touchRef.current.isDragging = false;
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [translateX, clamp]);

  useEffect(() => {
    if (!innerRef.current || !containerRef.current) return;
    const tabs = ['tree', 'members', 'timeline', 'memories', 'report', 'registries'];
    const idx = tabs.indexOf(activeTab);
    if (idx < 0) return;
    const tabElements = innerRef.current.querySelectorAll('[role="tab"]');
    if (idx >= tabElements.length) return;
    const tab = tabElements[idx] as HTMLElement;
    const containerWidth = containerRef.current.offsetWidth;
    const tabLeft = tab.offsetLeft;
    const tabWidth = tab.offsetWidth;
    const tabCenter = tabLeft + tabWidth / 2;
    const desiredTranslate = -(tabCenter - containerWidth / 2);
    setTranslateX(clamp(desiredTranslate));
  }, [activeTab, clamp]);

  const maxScroll = getMaxScroll();
  const showLeftFade = translateX < -5;
  const showRightFade = Math.abs(translateX) < maxScroll - 5;

  return (
    <div className="border-b border-border bg-card/50 relative" ref={containerRef} style={{ overflow: 'hidden' }} data-testid="tab-scroll-container">
      {showLeftFade && (
        <div className="absolute left-0 top-0 bottom-0 w-6 z-10 pointer-events-none" style={{ background: 'linear-gradient(to right, hsl(var(--card)/0.9), transparent)' }} />
      )}
      {showRightFade && (
        <div className="absolute right-0 top-0 bottom-0 w-6 z-10 pointer-events-none" style={{ background: 'linear-gradient(to left, hsl(var(--card)/0.9), transparent)' }} />
      )}
      <div
        ref={innerRef}
        style={{
          transform: `translateX(${translateX}px)`,
          transition: touchRef.current.isDragging ? 'none' : 'transform 0.25s ease-out',
          willChange: 'transform',
        }}
      >
        <TabsList className="bg-transparent h-12 p-0 gap-1 sm:gap-4 inline-flex flex-nowrap w-max px-4">
          {children}
        </TabsList>
      </div>
    </div>
  );
}

export default function TreeView() {
  const [, params] = useRoute("/tree/:id");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("tree");
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const [autoOpenAddRelationship, setAutoOpenAddRelationship] = useState(false);
  const [focusMemberId, setFocusMemberId] = useState<string | null>(null);
  const [groupLayoutMode, setGroupLayoutMode] = useState<GroupLayoutMode>("auto");
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
  const [newTreeType, setNewTreeType] = useState<string>("");
  const [newTreeTypeLabel, setNewTreeTypeLabel] = useState("");
  const [discoveryEnabled, setDiscoveryEnabled] = useState(false);
  const [discoveryDescription, setDiscoveryDescription] = useState("");
  const [discoveryCategory, setDiscoveryCategory] = useState("");
  const [discoveryLocation, setDiscoveryLocation] = useState("");
  const [autoJoinEnabled, setAutoJoinEnabled] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isInviteConnectOpen, setIsInviteConnectOpen] = useState(false);
  const [isSmartMatchOpen, setIsSmartMatchOpen] = useState(false);
  const [isEditMemberOpen, setIsEditMemberOpen] = useState(false);
  const [showPaymentGate, setShowPaymentGate] = useState(false);
  const [paymentGateInfo, setPaymentGateInfo] = useState<{ limit?: number; current: number; credits?: number }>({ current: 0 });
  const [isExporting, setIsExporting] = useState(false);
  const [editingRelationship, setEditingRelationship] = useState<{ id: string; currentType: string; currentQualifier: string | null; currentCustomLabel: string | null; member1Name: string; member2Name: string; member1Id: string; member2Id: string; fromMemberId: string; toMemberId: string } | null>(null);
  const [editSwapDirection, setEditSwapDirection] = useState(false);
  const [newCustomLabel, setNewCustomLabel] = useState<string>("");
  const [newRelationshipType, setNewRelationshipType] = useState<string>("");
  const [newRelationshipQualifier, setNewRelationshipQualifier] = useState<string | null>(null);
  const [isEditCustomType, setIsEditCustomType] = useState(false);
  const [editCustomTypeName, setEditCustomTypeName] = useState("");
  const [editCustomReverseLabel, setEditCustomReverseLabel] = useState("");
  const [showMergedView, setShowMergedView] = useState(false);
  const [selectedConnectedTrees, setSelectedConnectedTrees] = useState<Set<string> | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [isMergeDialogOpen, setIsMergeDialogOpen] = useState(false);
  const [isMemberPoolOpen, setIsMemberPoolOpen] = useState(false);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [crossTreeMergeData, setCrossTreeMergeData] = useState<{
    connectedMember: FamilyMember;
    ownTreeMember: FamilyMember;
    connectedTreeName: string;
  } | null>(null);
  const [showCrossTreeMerge, setShowCrossTreeMerge] = useState(false);
  const [showSamePersonPicker, setShowSamePersonPicker] = useState(false);
  const [samePersonSearch, setSamePersonSearch] = useState("");
  const [isFocusPanelCollapsed, setIsFocusPanelCollapsed] = useState(false);
  const [viewDepth, setViewDepth] = useState<'immediate' | 'extended' | 'all'>('all');
  const [isCreateSubgroupOpen, setIsCreateSubgroupOpen] = useState(false);
  const [newSubgroupName, setNewSubgroupName] = useState("");
  const [isMoveUnderParentOpen, setIsMoveUnderParentOpen] = useState(false);
  const [selectedParentTreeId, setSelectedParentTreeId] = useState<string>("");
  const [isSplitTreeOpen, setIsSplitTreeOpen] = useState(false);
  const [splitTreeName, setSplitTreeName] = useState("");
  const [splitSelectedMembers, setSplitSelectedMembers] = useState<Set<string>>(new Set());
  const [splitNewOwnerId, setSplitNewOwnerId] = useState<string>("");
  const [splitRootMemberId, setSplitRootMemberId] = useState<string>("");
  const [splitKeepLinked, setSplitKeepLinked] = useState(true);
  const [splitMemberSearch, setSplitMemberSearch] = useState("");
  const [importConnectionData, setImportConnectionData] = useState<{
    connectionId: string;
    connectorMemberId: string;
    sourceTreeName: string;
  } | null>(null);
  const [importPreviewData, setImportPreviewData] = useState<import("@/components/branch-import-dialog").ImportPreviewData | null>(null);
  const [isTagDialogOpen, setIsTagDialogOpen] = useState(false);
  const [newTagLabel, setNewTagLabel] = useState("");
  const [newTagColor, setNewTagColor] = useState("#6366f1");
  const [bulkTagId, setBulkTagId] = useState<string>("");
  const [bulkSelectedMembers, setBulkSelectedMembers] = useState<Set<string>>(new Set());
  const [bulkTagSearch, setBulkTagSearch] = useState("");
  const [filterTagId, setFilterTagId] = useState<string | null>(null);
  const [emailTagId, setEmailTagId] = useState<string>("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [createTreeTagId, setCreateTreeTagId] = useState<string>("");
  const [createTreeName, setCreateTreeName] = useState("");
  const [createTreeAsSubGroup, setCreateTreeAsSubGroup] = useState(true);
  const [isCloneTreeOpen, setIsCloneTreeOpen] = useState(false);
  const [cloneTreeName, setCloneTreeName] = useState("");
  const [isBulkRelChangeOpen, setIsBulkRelChangeOpen] = useState(false);
  const [isDeletedMembersOpen, setIsDeletedMembersOpen] = useState(false);
  const [bulkRelFromType, setBulkRelFromType] = useState<string>("");
  const [bulkRelToType, setBulkRelToType] = useState<string>("");
  const [bulkRelExcludeIds, setBulkRelExcludeIds] = useState<Set<string>>(new Set());
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
    allAvailableConnectedTrees?: Array<{ id: string; name: string }>;
  }

  const selectedTreeIdsParam = selectedConnectedTrees ? Array.from(selectedConnectedTrees).sort().join(',') : '';

  const { data: mergedData, isLoading: isMergedLoading } = useQuery<MergedTreeData>({
    queryKey: ["/api/trees", treeId, "merged", selectedTreeIdsParam],
    queryFn: async () => {
      const url = selectedConnectedTrees !== null
        ? `/api/trees/${treeId}/merged?treeIds=${Array.from(selectedConnectedTrees).join(',')}`
        : `/api/trees/${treeId}/merged`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch merged data");
      return res.json();
    },
    enabled: !!treeId && showMergedView,
  });

  // Initialize selectedConnectedTrees when merged data first loads
  useEffect(() => {
    if (mergedData?.allAvailableConnectedTrees && selectedConnectedTrees === null) {
      setSelectedConnectedTrees(new Set(mergedData.allAvailableConnectedTrees.map(t => t.id)));
    }
  }, [mergedData?.allAvailableConnectedTrees, selectedConnectedTrees]);

  // Determine which data to use based on merged view toggle
  const allDisplayMembers = showMergedView && mergedData ? mergedData.members : (treeData?.members || []);
  const displayRelationships = showMergedView && mergedData ? mergedData.relationships : (treeData?.relationships || []);

  const displayMembers = useMemo(() => {
    if (!filterTagId) return allDisplayMembers;
    const taggedMemberIds = new Set(
      treeData?.memberTags?.filter(mt => mt.tagId === filterTagId).map(mt => mt.memberId) || []
    );
    return allDisplayMembers.filter(m => taggedMemberIds.has(m.id));
  }, [allDisplayMembers, filterTagId, treeData?.memberTags]);
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
    // Fall back to root member, or first member if no root is set
    if (!focusMemberId && treeData?.tree) {
      if (treeData.tree.rootMemberId) {
        setFocusMemberId(treeData.tree.rootMemberId);
      } else if (treeData.members && treeData.members.length > 0) {
        setFocusMemberId(treeData.members[0].id);
      }
    }
    if (treeData?.tree?.preferredLayout && groupLayoutMode === "auto") {
      setGroupLayoutMode(treeData.tree.preferredLayout as GroupLayoutMode);
    }
  }, [treeData?.tree?.rootMemberId, treeData?.tree?.ownerId, treeData?.tree?.preferredLayout, treeData?.members, user?.id, user?.email, user?.firstName, user?.lastName, focusMemberId]);

  // Query collaborator status
  const { data: collaborators } = useQuery<Array<{userId: string; role: string}>>({
    queryKey: ["/api/trees", treeId, "collaborators"],
    enabled: !!treeId,
  });

  const { data: upcomingEventsData } = useQuery<{
    upcomingBirthdays: { memberId: string; date: string; daysUntil: number }[];
    activeRegistries: { memberId: string; registryId: string; title: string; eventDate: string | null; daysUntil: number | null }[];
  }>({
    queryKey: [`/api/trees/${treeId}/upcoming-events`],
    enabled: !!treeId,
  });

  const upcomingEvents = useMemo<MemberUpcomingEvent[]>(() => {
    if (!upcomingEventsData) return [];
    const events: MemberUpcomingEvent[] = [];
    for (const bd of upcomingEventsData.upcomingBirthdays) {
      events.push({
        memberId: bd.memberId,
        type: "birthday",
        label: bd.daysUntil === 0 ? "Birthday today!" : `Birthday in ${bd.daysUntil} days`,
        daysUntil: bd.daysUntil,
      });
    }
    for (const reg of upcomingEventsData.activeRegistries) {
      events.push({
        memberId: reg.memberId,
        type: "registry",
        label: reg.title,
        daysUntil: reg.daysUntil,
      });
    }
    return events;
  }, [upcomingEventsData]);

  const { data: mutedMemberIds = [] } = useQuery<string[]>({
    queryKey: ["/api/trees", treeId, "muted-member-ids"],
    queryFn: async () => {
      const res = await fetch(`/api/trees/${treeId}/muted-member-ids`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!treeId && !!user,
  });

  const muteMemberMutation = useMutation({
    mutationFn: async ({ memberId, scope }: { memberId: string; scope: "member" | "branch" }) => {
      return apiRequest("POST", `/api/trees/${treeId}/mutes`, { memberId, scope });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trees", treeId, "muted-member-ids"] });
      toast({ title: "Muted", description: "You won't receive activity updates from this member" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to mute member", variant: "destructive" });
    },
  });

  const unmuteMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      return apiRequest("DELETE", `/api/trees/${treeId}/mutes/${memberId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trees", treeId, "muted-member-ids"] });
      toast({ title: "Unmuted", description: "You'll receive activity updates from this member again" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to unmute member", variant: "destructive" });
    },
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
    mutationFn: async (data: InsertFamilyMember & { selectedTagIds?: string[] }) => {
      const { selectedTagIds, ...memberData } = data as any;
      const res = await fetch(`/api/trees/${treeId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(memberData),
        credentials: "include",
      });
      if (!res.ok) {
        const errorData = await res.json();
        if (res.status === 402 && (errorData.code === "FREE_TIER_MEMBER_LIMIT" || errorData.code === "NO_CREDITS")) {
          throw { isPaymentGate: true, ...errorData };
        }
        throw new Error(errorData.message || "Failed to add member");
      }
      const result = await res.json();
      if (selectedTagIds && selectedTagIds.length > 0 && result.id) {
        for (const tagId of selectedTagIds) {
          try {
            await apiRequest("POST", `/api/trees/${treeId}/members/${result.id}/tags`, { tagId });
          } catch {}
        }
      }
      return result;
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
        setPaymentGateInfo({ current: error.current || 0, credits: error.credits || 0 });
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
      queryClient.invalidateQueries({ queryKey: [`/api/deleted/trees/${treeId}/members`] });
      setIsMemberDetailOpen(false);
      setSelectedMember(null);
      toast({
        title: "Moved to Trash",
        description: "Member moved to Recently Deleted. You can restore them from the tree menu.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove member",
        variant: "destructive",
      });
    },
  });

  const { data: deletedMembers } = useQuery<any[]>({
    queryKey: [`/api/deleted/trees/${treeId}/members`],
    enabled: !!(treeId && (isOwner || isCoOwner)),
  });

  const restoreMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      return apiRequest("PATCH", `/api/deleted/trees/${treeId}/members/${memberId}/restore`);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/trees", treeId] });
      queryClient.invalidateQueries({ queryKey: [`/api/deleted/trees/${treeId}/members`] });
      const relCount = data?.restoredRelationships || 0;
      const relSummary = relCount > 0
        ? ` with ${relCount} relationship${relCount > 1 ? 's' : ''}`
        : '';
      toast({
        title: "Member Restored",
        description: `Member has been restored successfully${relSummary}.`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to restore member",
        variant: "destructive",
      });
    },
  });

  const permanentDeleteMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      return apiRequest("DELETE", `/api/deleted/trees/${treeId}/members/${memberId}/permanent`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/deleted/trees/${treeId}/members`] });
      toast({
        title: "Permanently Deleted",
        description: "Member has been permanently deleted.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to permanently delete member",
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

  const updateMemberPositionMutation = useMutation({
    mutationFn: async (data: { memberId: string; position: { x: number; y: number } }) => {
      await apiRequest("PATCH", `/api/trees/${treeId}/members/${data.memberId}`, {
        customPosition: data.position,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trees", treeId] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save position",
        variant: "destructive",
      });
    },
  });

  const importPreviewConfig = useMemo(() => {
    if (!importPreviewData) return null;
    return {
      members: importPreviewData.selectedMembers.map(m => ({
        id: m.id,
        firstName: m.firstName,
        lastName: m.lastName,
        photoUrl: m.photoUrl,
        gender: m.gender,
      })),
      relationships: importPreviewData.relationships,
      connectorSourceMemberId: importPreviewData.connectorMemberIds.sourceMemberId,
      connectorTargetMemberId: importPreviewData.connectorMemberIds.targetMemberId,
    };
  }, [importPreviewData]);

  const [pendingPositionChanges, setPendingPositionChanges] = useState<Map<string, { x: number; y: number }>>(new Map());

  const handleMemberPositionChange = useCallback(
    (memberId: string, position: { x: number; y: number }) => {
      setPendingPositionChanges(prev => {
        const next = new Map(prev);
        next.set(memberId, position);
        return next;
      });
    },
    []
  );

  const saveLayoutMutation = useMutation({
    mutationFn: async (positions: Array<{ memberId: string; position: { x: number; y: number } }>) => {
      await apiRequest("PATCH", `/api/trees/${treeId}/members/positions`, { positions });
    },
    onSuccess: () => {
      setPendingPositionChanges(new Map());
      queryClient.invalidateQueries({ queryKey: ["/api/trees", treeId] });
      toast({
        title: "Layout saved",
        description: "Node positions have been saved successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save layout positions",
        variant: "destructive",
      });
    },
  });

  const handleSaveLayout = useCallback(() => {
    if (pendingPositionChanges.size === 0) return;
    const positions = Array.from(pendingPositionChanges.entries()).map(([memberId, position]) => ({
      memberId,
      position,
    }));
    saveLayoutMutation.mutate(positions);
  }, [pendingPositionChanges, saveLayoutMutation]);

  const renameTreeMutation = useMutation({
    mutationFn: async (data: { name?: string; treeType?: string; treeTypeLabel?: string | null }) => {
      const body: Record<string, any> = {};
      if (data.name) body.name = data.name;
      if (data.treeType) {
        body.treeType = data.treeType;
        body.treeTypeLabel = data.treeType === 'custom' ? (data.treeTypeLabel || null) : null;
      }
      return apiRequest("PATCH", `/api/trees/${treeId}`, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trees", treeId] });
      queryClient.invalidateQueries({ queryKey: ["/api/trees"] });
      setIsRenameOpen(false);
      toast({
        title: "Success",
        description: "Tree settings updated!",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update tree settings",
        variant: "destructive",
      });
    },
  });

  const createSubgroupMutation = useMutation({
    mutationFn: async (data: { name: string }) => {
      const res = await apiRequest("POST", `/api/trees/${treeId}/children`, { name: data.name });
      return res.json();
    },
    onSuccess: (newTree) => {
      queryClient.invalidateQueries({ queryKey: ["/api/trees", treeId] });
      queryClient.invalidateQueries({ queryKey: ["/api/trees"] });
      queryClient.invalidateQueries({ queryKey: ["/api/discover"] });
      setIsCreateSubgroupOpen(false);
      setNewSubgroupName("");
      toast({
        title: "Sub-group created!",
        description: `"${newTree.name}" has been created under this group.`,
      });
      navigate(`/tree/${newTree.id}`);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create sub-group",
        variant: "destructive",
      });
    },
  });

  const moveTreeParentMutation = useMutation({
    mutationFn: async (parentTreeId: string | null) => {
      const res = await apiRequest("PATCH", `/api/trees/${treeId}/parent`, { parentTreeId });
      return res.json();
    },
    onSuccess: (_, parentTreeId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/trees", treeId] });
      queryClient.invalidateQueries({ queryKey: ["/api/trees"] });
      queryClient.invalidateQueries({ queryKey: ["/api/discover"] });
      if (parentTreeId) {
        queryClient.invalidateQueries({ queryKey: ["/api/trees", parentTreeId] });
      }
      if (treeData?.tree?.parentTreeId) {
        queryClient.invalidateQueries({ queryKey: ["/api/trees", treeData.tree.parentTreeId] });
      }
      setIsMoveUnderParentOpen(false);
      setSelectedParentTreeId("");
      toast({
        title: parentTreeId ? "Tree moved!" : "Tree detached!",
        description: parentTreeId
          ? "This tree is now a sub-group of the selected parent."
          : "This tree is now a standalone group.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to update tree parent",
        variant: "destructive",
      });
    },
  });

  const splitTreeMutation = useMutation({
    mutationFn: async (data: { name: string; memberIds: string[]; newOwnerId?: string; rootMemberId?: string; createConnection?: boolean }) => {
      const res = await apiRequest("POST", `/api/trees/${treeId}/split`, data);
      return res.json();
    },
    onSuccess: (newTree: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/trees", treeId] });
      queryClient.invalidateQueries({ queryKey: ["/api/trees"] });
      setIsSplitTreeOpen(false);
      setSplitTreeName("");
      setSplitSelectedMembers(new Set());
      setSplitNewOwnerId("");
      setSplitRootMemberId("");
      setSplitKeepLinked(true);
      setSplitMemberSearch("");
      toast({
        title: "Tree split successfully!",
        description: `"${newTree.name}" has been created with the selected members.`,
      });
      navigate(`/tree/${newTree.id}`);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to split tree",
        variant: "destructive",
      });
    },
  });

  const cloneTreeMutation = useMutation({
    mutationFn: async (data: { name: string }) => {
      const res = await apiRequest("POST", `/api/trees/${treeId}/clone`, data);
      return res.json();
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/trees"] });
      setIsCloneTreeOpen(false);
      setCloneTreeName("");
      toast({
        title: "Tree cloned successfully!",
        description: `"${result.tree.name}" has been created with all members and relationships.`,
      });
      navigate(`/tree/${result.tree.id}`);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to clone tree",
        variant: "destructive",
      });
    },
  });

  const addTagMutation = useMutation({
    mutationFn: async (data: { label: string; color: string }) => {
      const res = await apiRequest("POST", `/api/trees/${treeId}/tags`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trees", treeId] });
      queryClient.invalidateQueries({ queryKey: ["/api/trees"] });
      setNewTagLabel("");
      setNewTagColor("#6366f1");
      toast({ title: "Tag added" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error?.message || "Failed to add tag", variant: "destructive" });
    },
  });

  const deleteTagMutation = useMutation({
    mutationFn: async (tagId: string) => {
      await apiRequest("DELETE", `/api/trees/${treeId}/tags/${tagId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trees", treeId] });
      queryClient.invalidateQueries({ queryKey: ["/api/trees"] });
      toast({ title: "Tag removed" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to remove tag", variant: "destructive" });
    },
  });

  const addMemberTagMutation = useMutation({
    mutationFn: async ({ memberId, tagId }: { memberId: string; tagId: string }) => {
      const res = await apiRequest("POST", `/api/trees/${treeId}/members/${memberId}/tags`, { tagId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trees", treeId] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add tag", variant: "destructive" });
    },
  });

  const removeMemberTagMutation = useMutation({
    mutationFn: async ({ memberId, tagId }: { memberId: string; tagId: string }) => {
      await apiRequest("DELETE", `/api/trees/${treeId}/members/${memberId}/tags/${tagId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trees", treeId] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to remove tag", variant: "destructive" });
    },
  });

  const bulkAssignTagMutation = useMutation({
    mutationFn: async ({ tagId, memberIds }: { tagId: string; memberIds: string[] }) => {
      const res = await apiRequest("POST", `/api/trees/${treeId}/tags/${tagId}/members`, { memberIds });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trees", treeId] });
      toast({ title: "Tags assigned" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to assign tags", variant: "destructive" });
    },
  });

  const createTreeFromTagMutation = useMutation({
    mutationFn: async ({ tagId, name, createAsSubGroup }: { tagId: string; name: string; createAsSubGroup: boolean }) => {
      const res = await apiRequest("POST", `/api/trees/${treeId}/tags/${tagId}/create-tree`, { name, createAsSubGroup });
      return res.json();
    },
    onSuccess: (newTree: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/trees", treeId] });
      queryClient.invalidateQueries({ queryKey: ["/api/trees"] });
      setCreateTreeTagId("");
      setCreateTreeName("");
      toast({ title: "Tree created", description: `"${newTree.name}" has been created with the tagged members.` });
      navigate(`/tree/${newTree.id}`);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create tree from tag", variant: "destructive" });
    },
  });

  const emailTagGroupMutation = useMutation({
    mutationFn: async ({ tagId, subject, message }: { tagId: string; subject: string; message: string }) => {
      const res = await apiRequest("POST", `/api/trees/${treeId}/tags/${tagId}/email`, { subject, message });
      return res.json();
    },
    onSuccess: (result: any) => {
      setEmailTagId("");
      setEmailSubject("");
      setEmailMessage("");
      toast({
        title: "Emails sent",
        description: `${result.sent} email${result.sent !== 1 ? "s" : ""} sent successfully${result.failed > 0 ? `, ${result.failed} failed` : ""}.`,
      });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to send emails", variant: "destructive" });
    },
  });

  const { data: allUserTrees } = useQuery<any[]>({
    queryKey: ["/api/trees"],
    enabled: isMoveUnderParentOpen,
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

  const autoConnectMutation = useMutation({
    mutationFn: async (data: { mode: "leader" | "peer"; leaderId?: string; leaderRelationshipType?: string; peerRelationshipType?: string }) => {
      return apiRequest("POST", `/api/trees/${treeId}/auto-relationships`, data);
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/trees", treeId] });
      toast({
        title: "Connections Created",
        description: `${result.created} new connection${result.created !== 1 ? 's' : ''} added${result.skipped > 0 ? ` (${result.skipped} already existed)` : ''}.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to auto-connect members",
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
    mutationFn: async ({ relationshipId, newType, newQualifier, customLabel, swapDirection }: { relationshipId: string; newType?: string; newQualifier?: string | null; customLabel?: string | null; swapDirection?: boolean }) => {
      return apiRequest("PATCH", `/api/trees/${treeId}/relationships/${relationshipId}`, {
        relationshipType: newType,
        qualifier: newQualifier,
        customLabel: customLabel,
        swapDirection: swapDirection || false,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trees", treeId] });
      setEditingRelationship(null);
      setNewRelationshipType("");
      setNewRelationshipQualifier(null);
      setNewCustomLabel("");
      setEditSwapDirection(false);
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

  const bulkUpdateRelationshipsMutation = useMutation({
    mutationFn: async (data: { relationshipIds: string[]; newRelationshipType: string }) => {
      const res = await apiRequest("PATCH", `/api/trees/${treeId}/relationships/bulk-update`, data);
      return await res.json();
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/trees", treeId] });
      setIsBulkRelChangeOpen(false);
      setBulkRelFromType("");
      setBulkRelToType("");
      setBulkRelExcludeIds(new Set());
      toast({
        title: "Relationships Updated",
        description: `${result.updated} relationship${result.updated !== 1 ? 's' : ''} changed successfully.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update relationships",
        variant: "destructive",
      });
    },
  });

  const handleRenameOpen = () => {
    setNewTreeName(treeData?.tree.name || "");
    setNewTreeType(treeData?.tree.treeType || "family");
    setNewTreeTypeLabel((treeData?.tree as any).treeTypeLabel || "");
    setDiscoveryEnabled(treeData?.tree.isDiscoverable || false);
    setDiscoveryDescription(treeData?.tree.discoveryDescription || "");
    setDiscoveryCategory(treeData?.tree.discoveryCategory || "");
    setDiscoveryLocation(treeData?.tree.discoveryLocation || "");
    setAutoJoinEnabled(treeData?.tree.autoJoin || false);
    setIsRenameOpen(true);
  };

  const handleRenameSubmit = () => {
    const updates: { name?: string; treeType?: string; treeTypeLabel?: string | null } = {};
    if (newTreeName.trim() && newTreeName.trim() !== treeData?.tree.name) {
      updates.name = newTreeName.trim();
    }
    if (newTreeType && newTreeType !== (treeData?.tree.treeType || "family")) {
      updates.treeType = newTreeType;
      updates.treeTypeLabel = newTreeType === 'custom' ? newTreeTypeLabel || null : null;
    }
    const discoveryUpdates = {
      isDiscoverable: discoveryEnabled,
      discoveryDescription: discoveryDescription.trim() || null,
      discoveryCategory: discoveryCategory || null,
      discoveryLocation: discoveryLocation.trim() || null,
      autoJoin: autoJoinEnabled,
    };
    const discoveryChanged = 
      discoveryEnabled !== (treeData?.tree.isDiscoverable || false) ||
      discoveryDescription.trim() !== (treeData?.tree.discoveryDescription || "") ||
      discoveryCategory !== (treeData?.tree.discoveryCategory || "") ||
      discoveryLocation.trim() !== (treeData?.tree.discoveryLocation || "") ||
      autoJoinEnabled !== (treeData?.tree.autoJoin || false);

    if (Object.keys(updates).length > 0) {
      renameTreeMutation.mutate(updates);
    }
    if (discoveryChanged) {
      updateDiscoveryMutation.mutate(discoveryUpdates);
    }
    if (Object.keys(updates).length === 0 && !discoveryChanged) {
      setIsRenameOpen(false);
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

  const updateDiscoveryMutation = useMutation({
    mutationFn: async (data: { isDiscoverable: boolean; discoveryDescription: string | null; discoveryCategory: string | null; discoveryLocation: string | null; autoJoin: boolean }) => {
      return apiRequest("PATCH", `/api/trees/${treeId}/discovery`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trees", treeId] });
      toast({
        title: "Discovery settings updated",
        description: discoveryEnabled ? "Your tree is now discoverable" : "Your tree is now private",
      });
      setIsRenameOpen(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update discovery settings",
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
    setAutoOpenAddRelationship(false);
  };

  const handleConnectMember = (member: FamilyMember) => {
    setSelectedMember(member);
    setIsMemberDetailOpen(true);
    setAutoOpenAddRelationship(true);
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
    <div className="h-dvh bg-background flex flex-col overflow-hidden">
      <SEO
        title={`${treeName} - FamilyRoots`}
        description={`Explore and manage ${treeName} with ${memberCount} family members. Add members, define relationships, and visualize your family history.`}
        keywords="family tree, genealogy, ancestry, family members, relationships"
      />
      <header className="sticky top-0 z-50 backdrop-blur-md bg-background/80 border-b border-border">
        <div className="container mx-auto px-2 sm:px-4 py-2 sm:py-0 sm:h-14 flex items-center justify-between gap-1 sm:gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Button 
              variant="ghost" 
              size="icon" 
              className="shrink-0"
              onClick={() => navigate("/")}
              data-testid="button-back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="min-w-0">
              {isLoading ? (
                <Skeleton className="h-6 w-40" />
              ) : (
                <>
                  {treeData?.parentTree && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <button
                        onClick={() => navigate(`/tree/${treeData.parentTree!.id}`)}
                        className="hover:text-primary hover:underline truncate max-w-[120px]"
                        data-testid="link-parent-tree"
                      >
                        {treeData.parentTree.name}
                      </button>
                      <ChevronRight className="h-3 w-3 shrink-0" />
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <h1 className="font-serif text-base sm:text-lg font-semibold truncate">{treeData?.tree.name}</h1>
                    {(isOwner || isCoOwner) && (
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="shrink-0 h-7 w-7"
                        onClick={handleRenameOpen}
                        data-testid="button-rename-tree"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {treeData?.tree.privacy}
                    </Badge>
                    {treeData?.tree.isDiscoverable && !isOwner && !isCoOwner && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="outline" className="text-xs gap-1" data-testid="badge-moderated">
                            <BellOff className="h-3 w-3" />
                            Moderated
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-[200px] text-xs">Notifications are moderated. Only the tree owner and co-owners can send group-wide notifications.</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {treeData?.members?.length || 0} members
                    </span>
                  </div>
                  {(treeData?.tags && treeData.tags.length > 0) && (
                    <div className="flex items-center gap-1 flex-wrap sm:flex-wrap overflow-x-auto scrollbar-hide" data-testid="tree-tags-display">
                      {treeData.tags.map((tag) => (
                        <Badge
                          key={tag.id}
                          variant={filterTagId === tag.id ? "default" : "outline"}
                          className="text-xs gap-1 px-2 py-0 cursor-pointer transition-all"
                          style={filterTagId === tag.id
                            ? { backgroundColor: tag.color || "#6366f1", borderColor: tag.color || "#6366f1", color: "#fff" }
                            : { borderColor: tag.color || "#6366f1", color: tag.color || "#6366f1" }}
                          onClick={() => setFilterTagId(filterTagId === tag.id ? null : tag.id)}
                          data-testid={`tag-filter-${tag.id}`}
                        >
                          {tag.label}
                          {canEditTree && !filterTagId && (
                            <button
                              className="ml-0.5 hover:opacity-70"
                              onClick={(e) => { e.stopPropagation(); deleteTagMutation.mutate(tag.id); }}
                              data-testid={`button-delete-tag-${tag.id}`}
                            >
                              ×
                            </button>
                          )}
                        </Badge>
                      ))}
                      {canEditTree && (
                        <button
                          className="text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => setIsTagDialogOpen(true)}
                          data-testid="button-add-tag-inline"
                        >
                          + Tag
                        </button>
                      )}
                    </div>
                  )}
                  {filterTagId && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">
                        Filtering: {displayMembers.length} member{displayMembers.length !== 1 ? "s" : ""}
                      </span>
                      <button
                        className="text-primary hover:underline"
                        onClick={() => setFilterTagId(null)}
                        data-testid="button-clear-tag-filter"
                      >
                        Clear filter
                      </button>
                    </div>
                  )}
                  {(!treeData?.tags || treeData.tags.length === 0) && canEditTree && (
                    <button
                      className="text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => setIsTagDialogOpen(true)}
                      data-testid="button-add-first-tag"
                    >
                      + Add Tag
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
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
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 hidden sm:flex"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsInviteConnectOpen(true);
              }}
              data-testid="button-invite-connect"
              title="Invite someone to connect"
            >
              <UserPlus className="h-4 w-4" />
              <span className="hidden lg:inline">Invite</span>
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="sm:hidden"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsInviteConnectOpen(true);
              }}
              data-testid="button-invite-connect-mobile"
              title="Invite someone to connect"
            >
              <UserPlus className="h-4 w-4" />
            </Button>
            <Button 
              variant="outline" 
              size="icon" 
              className="hidden sm:flex"
              onClick={() => setIsShareOpen(true)}
              data-testid="button-share"
              title="Share & QR Code"
            >
              <QrCode className="h-4 w-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" data-testid="button-more-options">
                  <Menu className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="gap-2"
                  onSelect={(e) => {
                    e.preventDefault();
                    setTimeout(() => setIsInviteConnectOpen(true), 10);
                  }}
                  data-testid="menu-invite-to-connect"
                >
                  <UserPlus className="h-4 w-4" />
                  Invite to Connect
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="gap-2"
                  onSelect={(e) => {
                    e.preventDefault();
                    setTimeout(() => setIsSmartMatchOpen(true), 10);
                  }}
                  data-testid="menu-smart-match"
                >
                  <Search className="h-4 w-4" />
                  Smart Match
                </DropdownMenuItem>
                {canEditTree && (
                  <>
                    <DropdownMenuItem
                      className="gap-2 sm:hidden"
                      onClick={() => setIsBulkUploadOpen(true)}
                      data-testid="menu-bulk-upload-mobile"
                    >
                      <Upload className="h-4 w-4" />
                      Bulk Upload
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="gap-2 sm:hidden"
                      onClick={() => setIsMemberPoolOpen(true)}
                      data-testid="menu-from-network-mobile"
                    >
                      <Users className="h-4 w-4" />
                      From Network
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
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
                  <>
                    <DropdownMenuItem className="gap-2">
                      <Upload className="h-4 w-4" />
                      Import GEDCOM
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className="gap-2"
                      onClick={() => navigate(`/familysearch?tab=import&treeId=${treeId}`)}
                      data-testid="menu-import-familysearch"
                    >
                      <Download className="h-4 w-4" />
                      Import from FamilySearch
                    </DropdownMenuItem>
                  </>
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
                    {treeData && treeData.relationships.length > 0 && (
                      <DropdownMenuItem
                        className="gap-2"
                        onSelect={(e) => {
                          e.preventDefault();
                          setBulkRelFromType("");
                          setBulkRelToType("");
                          setBulkRelExcludeIds(new Set());
                          setTimeout(() => setIsBulkRelChangeOpen(true), 10);
                        }}
                        data-testid="menu-bulk-change-relationships"
                      >
                        <Edit className="h-4 w-4" />
                        Bulk Change Relationships
                      </DropdownMenuItem>
                    )}
                    {deletedMembers && deletedMembers.length > 0 && (
                      <DropdownMenuItem
                        className="gap-2"
                        onSelect={(e) => {
                          e.preventDefault();
                          setTimeout(() => setIsDeletedMembersOpen(true), 10);
                        }}
                        data-testid="menu-deleted-members"
                      >
                        <Trash2 className="h-4 w-4" />
                        Deleted Members ({deletedMembers.length})
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      className="gap-2"
                      onSelect={(e) => {
                        e.preventDefault();
                        setSplitNewOwnerId(userId || "");
                        setTimeout(() => setIsSplitTreeOpen(true), 10);
                      }}
                      data-testid="button-split-tree"
                    >
                      <Scissors className="h-4 w-4" />
                      Split Tree
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="gap-2"
                      onSelect={(e) => {
                        e.preventDefault();
                        setCloneTreeName(`Copy of ${treeData?.tree?.name || "Tree"}`);
                        setTimeout(() => setIsCloneTreeOpen(true), 10);
                      }}
                      data-testid="button-clone-tree"
                    >
                      <Copy className="h-4 w-4" />
                      Clone Tree
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="gap-2"
                      onSelect={(e) => {
                        e.preventDefault();
                        setTimeout(() => setIsMoveUnderParentOpen(true), 10);
                      }}
                      data-testid="button-move-under-parent"
                    >
                      <ArrowLeft className="h-4 w-4 rotate-[270deg]" />
                      Move Under Parent
                    </DropdownMenuItem>
                    {treeData?.parentTree && (
                      <DropdownMenuItem
                        className="gap-2"
                        onClick={() => moveTreeParentMutation.mutate(null)}
                        disabled={moveTreeParentMutation.isPending}
                        data-testid="button-detach-from-parent"
                      >
                        <GitBranch className="h-4 w-4" />
                        Detach from Parent
                      </DropdownMenuItem>
                    )}
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
                  onClick={() => {
                    const params = new URLSearchParams();
                    if ((treeData?.tree.treeType || "family") !== "family" && groupLayoutMode !== "auto") {
                      params.set("layout", groupLayoutMode);
                    }
                    if (treeId) params.set("treeId", treeId);
                    navigate(`/merchandise${params.toString() ? `?${params.toString()}` : ""}`);
                  }}
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
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  className="flex items-start gap-2"
                  onClick={() => navigate(`/familysearch?tab=import&treeId=${treeId}`)}
                  data-testid="menu-import-familysearch"
                >
                  <Download className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-medium">Import from FamilySearch</div>
                    <div className="text-xs text-muted-foreground">Pull ancestors from your FamilySearch tree</div>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="gap-2"
                  onClick={() => setIsShareOpen(true)}
                  data-testid="menu-tree-qr"
                >
                  <QrCode className="h-4 w-4" />
                  Tree QR Code
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="gap-2"
                  onClick={() => navigate("/share")}
                  data-testid="menu-share-app"
                >
                  <Link2 className="h-4 w-4" />
                  Share App
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <span className="hidden sm:inline-flex"><ThemeToggle /></span>
            {canEditTree && (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  className="gap-2 hidden sm:flex"
                  onClick={() => setIsBulkUploadOpen(true)}
                  data-testid="button-bulk-upload"
                >
                  <Upload className="h-4 w-4" />
                  <span className="hidden lg:inline">Bulk Upload</span>
                </Button>
                <Button
                  variant="outline"
                  className="gap-2 hidden sm:flex"
                  onClick={() => setIsMemberPoolOpen(true)}
                  data-testid="button-add-from-network"
                >
                  <Users className="h-4 w-4" />
                  <span className="hidden lg:inline">From Network</span>
                </Button>
                <Dialog open={isAddMemberOpen} onOpenChange={setIsAddMemberOpen}>
                  <DialogTrigger asChild>
                    <Button className="gap-2" data-testid="button-add-member">
                      <Plus className="h-4 w-4" />
                      <span className="hidden sm:inline">Add Member</span>
                    </Button>
                  </DialogTrigger>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="font-serif">
                    {treeData ? getTreeTypeConfig((treeData.tree.treeType || "family") as TreeType).addMemberLabel : "Add Member"}
                  </DialogTitle>
                  </DialogHeader>
                  <MemberForm 
                    treeId={treeId!}
                    onSubmit={(data) => addMemberMutation.mutate(data)}
                    isLoading={addMemberMutation.isPending}
                    availableTags={treeData?.tags}
                  />
                </DialogContent>
                </Dialog>
              </div>
            )}

            <Dialog open={isRenameOpen} onOpenChange={(open) => {
              setIsRenameOpen(open);
              if (!open) setNewTreeName("");
            }}>
              <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="font-serif">Tree Settings</DialogTitle>
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
                  <div className="space-y-2">
                    <Label htmlFor="tree-type">Tree Type</Label>
                    <Select value={newTreeType} onValueChange={setNewTreeType}>
                      <SelectTrigger id="tree-type" data-testid="select-tree-type">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="family">Family Tree</SelectItem>
                        <SelectItem value="church">Church / Faith Group</SelectItem>
                        <SelectItem value="sports">Sports Team</SelectItem>
                        <SelectItem value="fraternity">Fraternity / Sorority</SelectItem>
                        <SelectItem value="friends">Friend Circle</SelectItem>
                        <SelectItem value="professional">Professional Network</SelectItem>
                        <SelectItem value="custom">Custom Group</SelectItem>
                      </SelectContent>
                    </Select>
                    {newTreeType !== (treeData?.tree.treeType || "family") && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 flex items-start gap-1">
                        <RefreshCw className="h-3 w-3 mt-0.5 shrink-0" />
                        Changing the type will update the available relationship types and visual layout. Existing relationships will be kept.
                      </p>
                    )}
                  </div>
                  {newTreeType === "custom" && (
                    <div className="space-y-2">
                      <Label htmlFor="tree-type-label">Custom Type Label</Label>
                      <Input
                        id="tree-type-label"
                        value={newTreeTypeLabel}
                        onChange={(e) => setNewTreeTypeLabel(e.target.value)}
                        placeholder="e.g. Book Club, Dance Troupe"
                        data-testid="input-tree-type-label"
                      />
                    </div>
                  )}

                  {isOwner && (
                    <div className="border-t pt-4 space-y-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Globe className="h-4 w-4 text-primary" />
                        <Label className="text-sm font-semibold">Discovery Settings</Label>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor="discovery-toggle" className="text-sm">Make Discoverable</Label>
                          <p className="text-xs text-muted-foreground">Allow others to find and join this tree</p>
                        </div>
                        <Switch
                          id="discovery-toggle"
                          checked={discoveryEnabled}
                          onCheckedChange={setDiscoveryEnabled}
                          data-testid="switch-discovery"
                        />
                      </div>
                      {discoveryEnabled && (
                        <>
                          <div className="space-y-2">
                            <Label htmlFor="discovery-description" className="text-sm">Description</Label>
                            <Textarea
                              id="discovery-description"
                              value={discoveryDescription}
                              onChange={(e) => setDiscoveryDescription(e.target.value)}
                              placeholder="Briefly describe your group for others to find it..."
                              className="resize-none h-16 text-sm"
                              maxLength={200}
                              data-testid="input-discovery-description"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="discovery-category" className="text-sm">Category</Label>
                            <Select value={discoveryCategory} onValueChange={setDiscoveryCategory}>
                              <SelectTrigger id="discovery-category" data-testid="select-discovery-category">
                                <SelectValue placeholder="Choose a category" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="alumni">Alumni / School</SelectItem>
                                <SelectItem value="church">Church / Faith</SelectItem>
                                <SelectItem value="sports">Sports / Athletics</SelectItem>
                                <SelectItem value="greek">Fraternity / Sorority</SelectItem>
                                <SelectItem value="community">Community Group</SelectItem>
                                <SelectItem value="professional">Professional Network</SelectItem>
                                <SelectItem value="social">Friend Circle</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="discovery-location" className="text-sm">Location</Label>
                            <Input
                              id="discovery-location"
                              value={discoveryLocation}
                              onChange={(e) => setDiscoveryLocation(e.target.value)}
                              placeholder="e.g. Chicago, IL"
                              className="text-sm"
                              data-testid="input-discovery-location"
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <div>
                              <Label htmlFor="auto-join-toggle" className="text-sm">Auto-Join</Label>
                              <p className="text-xs text-muted-foreground">Members can join instantly without approval</p>
                            </div>
                            <Switch
                              id="auto-join-toggle"
                              checked={autoJoinEnabled}
                              onCheckedChange={setAutoJoinEnabled}
                              data-testid="switch-auto-join"
                            />
                          </div>
                        </>
                      )}
                    </div>
                  )}

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
                      disabled={!newTreeName.trim() || renameTreeMutation.isPending || updateDiscoveryMutation.isPending}
                      data-testid="button-save-rename"
                    >
                      {(renameTreeMutation.isPending || updateDiscoveryMutation.isPending) ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <ScrollableTabBar activeTab={activeTab}>
                <TabsTrigger 
                  value="tree" 
                  className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-12 gap-1.5 px-3 text-xs sm:text-sm shrink-0 whitespace-nowrap"
                  data-testid="tab-tree"
                >
                  <Trees className="h-4 w-4 shrink-0" />
                  Tree View
                </TabsTrigger>
                <TabsTrigger 
                  value="members" 
                  className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-12 gap-1.5 px-3 text-xs sm:text-sm shrink-0 whitespace-nowrap"
                  data-testid="tab-members"
                >
                  <Users className="h-4 w-4 shrink-0" />
                  Members
                </TabsTrigger>
                <TabsTrigger 
                  value="timeline" 
                  className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-12 gap-1.5 px-3 text-xs sm:text-sm shrink-0 whitespace-nowrap"
                  data-testid="tab-timeline"
                >
                  <Clock className="h-4 w-4 shrink-0" />
                  Timeline
                </TabsTrigger>
                <TabsTrigger 
                  value="wall" 
                  className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-12 gap-1.5 px-3 text-xs sm:text-sm shrink-0 whitespace-nowrap"
                  data-testid="tab-wall"
                >
                  <MessageSquare className="h-4 w-4 shrink-0" />
                  Wall
                </TabsTrigger>
                <TabsTrigger 
                  value="memories" 
                  className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-12 gap-1.5 px-3 text-xs sm:text-sm shrink-0 whitespace-nowrap"
                  data-testid="tab-memories"
                >
                  <BookHeart className="h-4 w-4 shrink-0" />
                  Memories
                </TabsTrigger>
                <TabsTrigger 
                  value="report" 
                  className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-12 gap-1.5 px-3 text-xs sm:text-sm shrink-0 whitespace-nowrap"
                  data-testid="tab-report"
                >
                  <BarChart3 className="h-4 w-4 shrink-0" />
                  Report
                </TabsTrigger>
                <TabsTrigger 
                  value="registries" 
                  className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-12 gap-1.5 px-3 text-xs sm:text-sm shrink-0 whitespace-nowrap"
                  data-testid="tab-registries"
                >
                  <Gift className="h-4 w-4 shrink-0" />
                  Registries
                </TabsTrigger>
          </ScrollableTabBar>

          {(treeData?.childTrees && treeData.childTrees.length > 0 || (isOwner || isCoOwner)) && (
            <div className="border-b border-border bg-muted/30 px-4 py-2">
              <div className="container mx-auto flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium text-muted-foreground shrink-0">Sub-groups:</span>
                {treeData?.childTrees?.map(child => (
                  <Button
                    key={child.id}
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => navigate(`/tree/${child.id}`)}
                    data-testid={`button-subgroup-${child.id}`}
                  >
                    <GitBranch className="h-3 w-3" />
                    {child.name}
                  </Button>
                ))}
                {(isOwner || isCoOwner) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1 border border-dashed border-muted-foreground/30"
                    onClick={() => setIsCreateSubgroupOpen(true)}
                    data-testid="button-create-subgroup"
                  >
                    <Plus className="h-3 w-3" />
                    New Sub-group
                  </Button>
                )}
              </div>
            </div>
          )}

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
                      {(treeData?.tree.treeType || "family") !== "family" && (
                        <div className="mt-3 pt-3 border-t">
                          <Label className="text-xs text-muted-foreground mb-2 block">Layout</Label>
                          <div className="flex flex-wrap gap-1">
                            {([
                              { value: "auto" as GroupLayoutMode, label: "Auto", icon: <Maximize2 className="h-3.5 w-3.5" /> },
                              { value: "hub" as GroupLayoutMode, label: "Hub", icon: <CircleDot className="h-3.5 w-3.5" /> },
                              { value: "top-grid" as GroupLayoutMode, label: "Grid", icon: <LayoutGrid className="h-3.5 w-3.5" /> },
                              { value: "radial" as GroupLayoutMode, label: "Radial", icon: <Orbit className="h-3.5 w-3.5" /> },
                              { value: "arc" as GroupLayoutMode, label: "Arc", icon: <GitBranch className="h-3.5 w-3.5" /> },
                              { value: "network" as GroupLayoutMode, label: "Network", icon: <Network className="h-3.5 w-3.5" /> },
                            ]).map(({ value, label, icon }) => (
                              <Button
                                key={value}
                                variant={groupLayoutMode === value ? "default" : "outline"}
                                size="sm"
                                className="h-7 px-2 text-xs gap-1"
                                onClick={() => {
                                  setGroupLayoutMode(value);
                                  if (canEditTree && treeId) {
                                    apiRequest("PATCH", `/api/trees/${treeId}`, { preferredLayout: value === "auto" ? null : value });
                                  }
                                }}
                                data-testid={`button-layout-${value}`}
                              >
                                {icon}
                                <span className="hidden sm:inline">{label}</span>
                              </Button>
                            ))}
                          </div>
                        </div>
                      )}
                      {(treeData?.tree.treeType || "family") !== "family" && canEditTree && displayMembers.length >= 2 && (
                        <div className="mt-3 pt-3 border-t">
                          <Label className="text-xs text-muted-foreground mb-2 block">Quick Connect</Label>
                          <div className="space-y-1.5">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full h-8 text-xs gap-1.5"
                                disabled={autoConnectMutation.isPending}
                                data-testid="button-auto-connect"
                              >
                                {autoConnectMutation.isPending ? (
                                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Link2 className="h-3.5 w-3.5" />
                                )}
                                Auto-Connect Members
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-64">
                              {(() => {
                                const tt = (treeData?.tree.treeType || "family") as TreeType;
                                const leaderDefaults = getDefaultLeaderRelationship(tt);
                                const peerDefault = getDefaultPeerRelationship(tt);
                                const relTypes = getRelationshipTypesForTree(tt, treeData?.tree.customRelationshipTypes as (string | { label: string; reverseLabel?: string })[] | null);
                                const peerLabel = relTypes.find(r => r.value === peerDefault)?.label || peerDefault;

                                return (
                                  <>
                                    <DropdownMenuItem
                                      onClick={() => autoConnectMutation.mutate({ mode: "peer", peerRelationshipType: peerDefault })}
                                      className="flex-col items-start gap-0.5"
                                      data-testid="auto-connect-peer"
                                    >
                                      <span className="font-medium">Connect All as {peerLabel}</span>
                                      <span className="text-xs text-muted-foreground">Every member gets connected to each other</span>
                                    </DropdownMenuItem>
                                    {leaderDefaults && focusMember && (
                                      <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                          onClick={() => autoConnectMutation.mutate({
                                            mode: "leader",
                                            leaderId: focusMember.id,
                                            leaderRelationshipType: leaderDefaults.leaderType,
                                          })}
                                          className="flex-col items-start gap-0.5"
                                          data-testid="auto-connect-leader"
                                        >
                                          <span className="font-medium">
                                            Set {focusMember.firstName} as {relTypes.find(r => r.value === leaderDefaults.leaderType)?.label || leaderDefaults.leaderType}
                                          </span>
                                          <span className="text-xs text-muted-foreground">
                                            Auto-connect to all other members
                                          </span>
                                        </DropdownMenuItem>
                                      </>
                                    )}
                                  </>
                                );
                              })()}
                            </DropdownMenuContent>
                          </DropdownMenu>
                          {treeData && treeData.relationships.length > 0 && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full h-8 text-xs gap-1.5"
                              onClick={() => {
                                setBulkRelFromType("");
                                setBulkRelToType("");
                                setBulkRelExcludeIds(new Set());
                                setIsBulkRelChangeOpen(true);
                              }}
                              data-testid="button-bulk-change-relationships"
                            >
                              <Edit className="h-3.5 w-3.5" />
                              Bulk Change Relationships
                            </Button>
                          )}
                          </div>
                        </div>
                      )}
                      {showMergedView && mergedData?.allAvailableConnectedTrees && mergedData.allAvailableConnectedTrees.length > 0 && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium">Connected trees:</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 px-1 text-xs"
                              onClick={() => {
                                if (selectedConnectedTrees && selectedConnectedTrees.size === mergedData.allAvailableConnectedTrees!.length) {
                                  setSelectedConnectedTrees(new Set());
                                } else {
                                  setSelectedConnectedTrees(new Set(mergedData.allAvailableConnectedTrees!.map(t => t.id)));
                                }
                              }}
                              data-testid="button-select-all-trees"
                            >
                              {selectedConnectedTrees && selectedConnectedTrees.size === mergedData.allAvailableConnectedTrees.length ? "None" : "All"}
                            </Button>
                          </div>
                          <div className="flex flex-col gap-1 mt-1">
                            {mergedData.allAvailableConnectedTrees.map(t => {
                              const isSelected = selectedConnectedTrees?.has(t.id) ?? true;
                              const connection = mergedData.connections.find(
                                c => c.tree1Id === t.id || c.tree2Id === t.id
                              );
                              const connectorMemberId = connection ? (
                                connection.tree1Id === treeId ? connection.connector2MemberId : connection.connector1MemberId
                              ) : null;
                              
                              return (
                                <div key={t.id} className="flex items-center gap-1.5">
                                  <Checkbox
                                    id={`tree-select-${t.id}`}
                                    checked={isSelected}
                                    onCheckedChange={(checked) => {
                                      const next = new Set(selectedConnectedTrees || []);
                                      if (checked) {
                                        next.add(t.id);
                                      } else {
                                        next.delete(t.id);
                                      }
                                      setSelectedConnectedTrees(next);
                                    }}
                                    data-testid={`checkbox-tree-${t.id}`}
                                    className="h-3.5 w-3.5"
                                  />
                                  <label htmlFor={`tree-select-${t.id}`} className="cursor-pointer text-xs truncate flex-1">
                                    {t.name}
                                  </label>
                                  {isSelected && connection && connectorMemberId && canEditTree && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-5 px-1 text-xs shrink-0"
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
                      {showMergedView && (!mergedData?.allAvailableConnectedTrees || mergedData.allAvailableConnectedTrees.length === 0) && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          No connected trees yet.
                        </p>
                      )}
                      
                      {/* FamilySearch Import Button */}
                      <div className="mt-3 pt-3 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full gap-2"
                          onClick={() => navigate(`/familysearch?tab=import&treeId=${treeId}`)}
                          data-testid="button-import-familysearch"
                        >
                          <Download className="h-4 w-4" />
                          <span className="text-xs">Import from FamilySearch</span>
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                <div ref={treeContainerRef} className="w-full h-full">
                  {(treeData?.tree.treeType || "family") === "family" ? (
                    <FamilyTreeVisualization
                      members={displayMembers}
                      relationships={displayRelationships}
                      zoom={zoom}
                      onMemberClick={handleMemberClick}
                      onConnectMember={canEditTree ? handleConnectMember : undefined}
                      focusMemberId={focusMemberId || treeData?.tree?.rootMemberId || null}
                      viewDepth={viewDepth}
                      upcomingEvents={upcomingEvents}
                      onMemberPositionChange={canEditTree ? handleMemberPositionChange : undefined}
                      importPreview={importPreviewConfig}
                    />
                  ) : (
                    <GroupVisualization
                      members={displayMembers}
                      relationships={displayRelationships}
                      zoom={zoom}
                      onMemberClick={handleMemberClick}
                      focusMemberId={focusMemberId || treeData?.tree?.rootMemberId || null}
                      treeType={(treeData?.tree.treeType || "family") as TreeType}
                      layoutOverride={groupLayoutMode}
                      onMemberPositionChange={handleMemberPositionChange}
                      customRelationshipTypes={(treeData?.tree.customRelationshipTypes as (string | { label: string; reverseLabel?: string })[] | null) || null}
                      upcomingEvents={upcomingEvents}
                      importPreview={importPreviewConfig}
                    />
                  )}
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
                      {showMergedView && mergedData?.allAvailableConnectedTrees && mergedData.allAvailableConnectedTrees.length > 0 && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium">Connected trees:</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 px-1 text-xs"
                              onClick={() => {
                                if (selectedConnectedTrees && selectedConnectedTrees.size === mergedData.allAvailableConnectedTrees!.length) {
                                  setSelectedConnectedTrees(new Set());
                                } else {
                                  setSelectedConnectedTrees(new Set(mergedData.allAvailableConnectedTrees!.map(t => t.id)));
                                }
                              }}
                              data-testid="button-select-all-trees-empty"
                            >
                              {selectedConnectedTrees && selectedConnectedTrees.size === mergedData.allAvailableConnectedTrees.length ? "None" : "All"}
                            </Button>
                          </div>
                          <div className="flex flex-col gap-1 mt-1">
                            {mergedData.allAvailableConnectedTrees.map(t => {
                              const isSelected = selectedConnectedTrees?.has(t.id) ?? true;
                              const connection = mergedData.connections.find(
                                c => c.tree1Id === t.id || c.tree2Id === t.id
                              );
                              const connectorMemberId = connection ? (
                                connection.tree1Id === treeId ? connection.connector2MemberId : connection.connector1MemberId
                              ) : null;
                              
                              return (
                                <div key={t.id} className="flex items-center gap-1.5">
                                  <Checkbox
                                    id={`tree-select-empty-${t.id}`}
                                    checked={isSelected}
                                    onCheckedChange={(checked) => {
                                      const next = new Set(selectedConnectedTrees || []);
                                      if (checked) {
                                        next.add(t.id);
                                      } else {
                                        next.delete(t.id);
                                      }
                                      setSelectedConnectedTrees(next);
                                    }}
                                    data-testid={`checkbox-tree-empty-${t.id}`}
                                    className="h-3.5 w-3.5"
                                  />
                                  <label htmlFor={`tree-select-empty-${t.id}`} className="cursor-pointer text-xs truncate flex-1">
                                    {t.name}
                                  </label>
                                  {isSelected && connection && connectorMemberId && canEditTree && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-5 px-1 text-xs shrink-0"
                                      onClick={() => {
                                        setImportConnectionData({
                                          connectionId: connection.id,
                                          connectorMemberId,
                                          sourceTreeName: t.name
                                        });
                                        setImportDialogOpen(true);
                                      }}
                                      data-testid={`button-import-empty-${t.id}`}
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
                      {showMergedView && (!mergedData?.allAvailableConnectedTrees || mergedData.allAvailableConnectedTrees.length === 0) && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          No connected trees yet.
                        </p>
                      )}
                          
                      {/* FamilySearch Import Button */}
                      <div className="mt-3 pt-3 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full gap-2"
                          onClick={() => navigate(`/familysearch?tab=import&treeId=${treeId}`)}
                          data-testid="button-import-familysearch-empty"
                        >
                          <Download className="h-4 w-4" />
                          <span className="text-xs">Import from FamilySearch</span>
                        </Button>
                      </div>
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
                      Add your first {treeData ? getTreeTypeConfig((treeData.tree.treeType || "family") as TreeType).memberLabel.toLowerCase() : "member"} to begin building your tree
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

          <TabsContent value="members" className="flex-1 m-0 overflow-y-auto">
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
                              <span>{parseDateString(member.birthDate)?.getFullYear()}</span>
                            )}
                            {member.birthDate && member.deathDate && <span>-</span>}
                            {member.deathDate && (
                              <span>{parseDateString(member.deathDate)?.getFullYear()}</span>
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

          <TabsContent value="timeline" className="flex-1 m-0 overflow-y-auto">
            <TimelineView 
              members={treeData?.members || []} 
              treeId={treeId!}
            />
          </TabsContent>

          <TabsContent value="wall" className="flex-1 m-0 overflow-hidden flex flex-col">
            <TreeWall treeId={treeId!} canEdit={canEditTree} />
          </TabsContent>

          <TabsContent value="memories" className="flex-1 m-0 overflow-y-auto">
            <div className="container mx-auto px-4 py-6">
              <MemoryLane 
                treeId={treeId!} 
                members={treeData?.members || []} 
                canEdit={canEditTree} 
              />
            </div>
          </TabsContent>

          <TabsContent value="report" className="flex-1 m-0 overflow-y-auto">
            <div className="container mx-auto px-4 py-6">
              <AnnualTreeReport 
                treeId={treeId!} 
                treeName={treeData?.tree?.name || ''} 
              />
            </div>
          </TabsContent>

          <TabsContent value="registries" className="flex-1 m-0 overflow-y-auto">
            <TreeRegistriesTab treeId={treeId!} canEdit={canEditTree} />
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
            {canEditTree && pendingPositionChanges.size > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="default"
                    size="icon"
                    onClick={handleSaveLayout}
                    disabled={saveLayoutMutation.isPending}
                    data-testid="button-save-layout"
                    className="h-10 w-10 sm:h-9 sm:w-9"
                    aria-label="Save layout"
                  >
                    <Save className="h-5 w-5 sm:h-4 sm:w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Save layout ({pendingPositionChanges.size} changed)</p>
                </TooltipContent>
              </Tooltip>
            )}
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
                      {!selectedMember.claimedByUserId && selectedMember.disassociatedAt && isOwner && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="outline" className="text-amber-600 border-amber-600/50 gap-1" data-testid="badge-disassociated">
                              <UserMinus className="h-3 w-3" />
                              Left
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{selectedMember.disassociatedName || "A member"} disassociated on {new Date(selectedMember.disassociatedAt).toLocaleDateString()}</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                      {mutedMemberIds.includes(selectedMember.id) && (
                        <Badge variant="outline" className="text-muted-foreground gap-1" data-testid="badge-muted">
                          <BellOff className="h-3 w-3" />
                          Muted
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </SheetHeader>

              {/* Member Tags */}
              {treeData?.tags && treeData.tags.length > 0 && (
                <div className="mb-4 px-1" data-testid="member-tags-section">
                  <div className="flex flex-wrap gap-1.5 items-center">
                    {treeData.tags.map((tag) => {
                      const isAssigned = treeData.memberTags?.some(
                        (mt) => mt.tagId === tag.id && mt.memberId === selectedMember.id
                      );
                      return (
                        <Badge
                          key={tag.id}
                          variant={isAssigned ? "default" : "outline"}
                          className={`text-xs cursor-pointer transition-all ${isAssigned ? "opacity-100" : "opacity-50 hover:opacity-75"}`}
                          style={isAssigned ? { backgroundColor: tag.color || "#6366f1", borderColor: tag.color || "#6366f1" } : { borderColor: tag.color || "#6366f1", color: tag.color || "#6366f1" }}
                          onClick={() => {
                            if (!canEditTree) return;
                            if (isAssigned) {
                              removeMemberTagMutation.mutate({ memberId: selectedMember.id, tagId: tag.id });
                            } else {
                              addMemberTagMutation.mutate({ memberId: selectedMember.id, tagId: tag.id });
                            }
                          }}
                          data-testid={`member-tag-toggle-${tag.id}`}
                        >
                          {tag.label}
                          {canEditTree && (
                            <span className="ml-1 text-[10px]">{isAssigned ? "x" : "+"}</span>
                          )}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              )}

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
                          <span>{parseDateString(selectedMember.birthDate)?.toLocaleDateString('en-US', { 
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
                      <span>{parseDateString(selectedMember.deathDate)?.toLocaleDateString('en-US', { 
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

                {isOwner && selectedMember && !selectedMember.isUnknown && (
                  <Card>
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Users className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium" data-testid="label-share-pool">Share in Family Pool</p>
                            <p className="text-xs text-muted-foreground">
                              {(selectedMember as any).sharedInPool
                                ? "Connected users can add this member to their trees"
                                : "Only visible in your trees"}
                            </p>
                          </div>
                        </div>
                        <Switch
                          checked={!!(selectedMember as any).sharedInPool}
                          onCheckedChange={async (checked) => {
                            try {
                              await apiRequest("PATCH", `/api/members/${selectedMember.id}/shared-in-pool`, { shared: checked });
                              queryClient.invalidateQueries({ queryKey: ["/api/trees", treeId] });
                              toast({
                                description: checked ? "Member is now shared in the family pool" : "Member removed from family pool",
                              });
                            } catch {
                              toast({ description: "Failed to update sharing", variant: "destructive" });
                            }
                          }}
                          data-testid={`toggle-share-pool-${selectedMember.id}`}
                        />
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Disassociation Notice (tree owner only) */}
                {!selectedMember.claimedByUserId && selectedMember.disassociatedAt && isOwner && (
                  <Card className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
                    <CardContent className="py-4">
                      <div className="flex items-start gap-3">
                        <UserMinus className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-amber-800 dark:text-amber-400" data-testid="text-disassociation-notice">
                            {selectedMember.disassociatedName || "A member"} left this tree
                          </p>
                          <p className="text-xs text-amber-700/80 dark:text-amber-500/80">
                            Disassociated on {new Date(selectedMember.disassociatedAt).toLocaleDateString()}. Their personal data was removed but your original entry (name and relationships) has been preserved. They can re-claim this profile if they return.
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

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

                {/* Gift Registry Section */}
                {treeData && (
                  <GiftRegistrySection
                    memberId={selectedMember.id}
                    treeId={treeData.tree.id}
                    canEdit={canEdit}
                    memberName={selectedMember.firstName + (selectedMember.lastName ? ` ${selectedMember.lastName}` : '')}
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

                {treeData && (
                  <VoiceNotesSection
                    memberId={selectedMember.id}
                    treeId={treeData.tree.id}
                    canEdit={canEdit}
                    memberName={selectedMember.firstName + (selectedMember.lastName ? ` ${selectedMember.lastName}` : '')}
                  />
                )}

                {/* Existing Relationships Section */}
                {treeData && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                      <Link2 className="h-4 w-4" />
                      {(() => {
                        const tt = (treeData.tree.treeType || "family") as TreeType;
                        const config = getTreeTypeConfig(tt);
                        return tt === "family" ? "Family Relationships" : `${config.label} Relationships`;
                      })()}
                    </h4>
                    {(() => {
                      const memberRelationships = treeData.relationships.filter(
                        r => r.fromMemberId === selectedMember.id || r.toMemberId === selectedMember.id
                      );
                      if (memberRelationships.length === 0) {
                        const treeType = (treeData.tree.treeType || "family") as TreeType;
                        return (
                          <p className="text-sm text-muted-foreground">
                            No relationships defined yet. Use the button below to add connections.
                          </p>
                        );
                      }
                      const getMember = (id: string) => treeData.members.find(m => m.id === id);
                      const getMemberName = (m: FamilyMember | undefined) => m ? (m.lastName ? `${m.firstName} ${m.lastName}` : m.firstName) + (m.suffix ? ` ${m.suffix}` : '') : "Unknown";
                      
                      // Build list of individual relationships with their IDs
                      const relationshipItems: { id: string; label: string; personName: string; description: string; fromMemberId: string; toMemberId: string; relationshipType: string; qualifier: string | null; customLabel: string | null; otherMemberName: string }[] = [];
                      
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
                              qualifier: r.qualifier || null,
                              customLabel: r.customLabel || null,
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
                              qualifier: r.qualifier || null,
                              customLabel: r.customLabel || null,
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
                              qualifier: r.qualifier || null,
                              customLabel: r.customLabel || null,
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
                              qualifier: r.qualifier || null,
                              customLabel: r.customLabel || null,
                              otherMemberName: getMemberName(sibling)
                            });
                          }
                        });
                      
                      // Co-Parents
                      memberRelationships
                        .filter(r => r.relationshipType === "coparent")
                        .forEach(r => {
                          const coparent = getMember(r.fromMemberId === selectedMember.id ? r.toMemberId : r.fromMemberId);
                          if (coparent) {
                            relationshipItems.push({
                              id: r.id,
                              label: "Co-Parent",
                              personName: getMemberName(coparent),
                              description: `${getMemberName(coparent)} shares a child with ${selectedMember.firstName}`,
                              fromMemberId: r.fromMemberId,
                              toMemberId: r.toMemberId,
                              relationshipType: r.relationshipType,
                              qualifier: r.qualifier || null,
                              customLabel: r.customLabel || null,
                              otherMemberName: getMemberName(coparent)
                            });
                          }
                        });

                      // All other relationship types (mentor, colleague, manager, etc.)
                      const handledTypes = new Set(["parent", "spouse", "sibling", "coparent"]);
                      const treeType = (treeData.tree.treeType || "family") as TreeType;
                      const allRelTypes = getRelationshipTypesForTree(treeType, treeData.tree.customRelationshipTypes as (string | { label: string; reverseLabel?: string })[] | null);
                      memberRelationships
                        .filter(r => !handledTypes.has(r.relationshipType))
                        .forEach(r => {
                          const otherMemberId = r.fromMemberId === selectedMember.id ? r.toMemberId : r.fromMemberId;
                          const otherMember = getMember(otherMemberId);
                          if (otherMember) {
                            const relConfig = allRelTypes.find(rt => rt.value === r.relationshipType);
                            const isFrom = r.fromMemberId === selectedMember.id;
                            let label = relConfig ? relConfig.label : r.relationshipType.charAt(0).toUpperCase() + r.relationshipType.slice(1).replace(/_/g, ' ');
                            if (!isFrom && relConfig?.reverseLabel) {
                              label = relConfig.reverseLabel;
                            }
                            relationshipItems.push({
                              id: r.id,
                              label,
                              personName: getMemberName(otherMember),
                              description: `${getMemberName(otherMember)} is ${selectedMember.firstName}'s ${label.toLowerCase()}`,
                              fromMemberId: r.fromMemberId,
                              toMemberId: r.toMemberId,
                              relationshipType: r.relationshipType,
                              qualifier: r.qualifier || null,
                              customLabel: r.customLabel || null,
                              otherMemberName: getMemberName(otherMember)
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
                                {item.customLabel && (
                                  <span className="text-xs text-muted-foreground italic truncate" data-testid={`text-custom-label-${item.id}`}>"{item.customLabel}"</span>
                                )}
                              </div>
                              {canEditTree && (
                                <div className="flex items-center gap-1">
                                  <Button 
                                    variant="ghost" 
                                    size="icon"
                                    onClick={() => {
                                      const isSelectedFrom = item.fromMemberId === selectedMember.id;
                                      setEditingRelationship({
                                        id: item.id,
                                        currentType: item.relationshipType,
                                        currentQualifier: item.qualifier,
                                        currentCustomLabel: item.customLabel || null,
                                        member1Name: isSelectedFrom ? selectedMember.firstName : item.otherMemberName,
                                        member2Name: isSelectedFrom ? item.otherMemberName : selectedMember.firstName,
                                        member1Id: item.fromMemberId,
                                        member2Id: item.toMemberId,
                                        fromMemberId: item.fromMemberId,
                                        toMemberId: item.toMemberId,
                                      });
                                      setNewRelationshipType(item.relationshipType);
                                      setNewRelationshipQualifier(item.qualifier);
                                      setNewCustomLabel(item.customLabel || "");
                                      setEditSwapDirection(false);
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
                      treeType={(treeData.tree.treeType || "family") as any}
                      customRelationshipTypes={treeData.tree.customRelationshipTypes as (string | { label: string; reverseLabel?: string })[] | null}
                      currentMember={selectedMember}
                      allMembers={treeData.members}
                      existingRelationships={treeData.relationships}
                      canEdit={canEditTree}
                      autoOpen={autoOpenAddRelationship}
                      onAutoOpenHandled={() => setAutoOpenAddRelationship(false)}
                    />
                  </div>
                )}

                {showMergedView && mergedData && treeData && (() => {
                  const isFromConnected = (selectedMember as any).isFromConnectedTree;
                  const hasConnectedMembers = mergedData.members.some(m => (m as any).isFromConnectedTree);
                  const hasOwnMembers = treeData.members.length > 0;
                  if (!hasConnectedMembers || !hasOwnMembers) return null;
                  return (
                    <div className="p-3 mb-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                      {isFromConnected && (
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="text-blue-600 border-blue-400 gap-1">
                            <Link2 className="h-3 w-3" />
                            From {(selectedMember as any).sourceTreeName || "Connected Tree"}
                          </Badge>
                        </div>
                      )}
                      <p className="text-sm text-muted-foreground mb-3">
                        {isFromConnected
                          ? "Is this person already in your tree? Merge them to sync their data across both trees."
                          : "Is this person also in a connected tree? Merge them to sync their data across both trees."}
                      </p>
                      <Button
                        variant="default"
                        className="gap-2 w-full"
                        onClick={() => {
                          setSamePersonSearch("");
                          setShowSamePersonPicker(true);
                        }}
                        data-testid="button-same-person"
                      >
                        <Merge className="h-4 w-4" />
                        Same Person — Merge Profiles
                      </Button>
                    </div>
                  );
                })()}

                <div className="flex gap-2 pt-4 border-t border-border flex-wrap">
                  <Button 
                    variant={focusMemberId === selectedMember.id ? "default" : "outline"} 
                    className="gap-2"
                    onClick={() => setFocusMemberId(focusMemberId === selectedMember.id ? null : selectedMember.id)}
                    data-testid="button-set-focus"
                  >
                    <User className="h-4 w-4" />
                    {(treeData?.tree.treeType || "family") !== "family" 
                      ? (focusMemberId === selectedMember.id ? "Centered" : "Place at Center")
                      : (focusMemberId === selectedMember.id ? "Focus Set" : "Set as Focus")}
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
                  {user && (() => {
                    const isMuted = mutedMemberIds.includes(selectedMember.id);
                    return isMuted ? (
                      <Button
                        variant="outline"
                        className="gap-2"
                        onClick={() => unmuteMemberMutation.mutate(selectedMember.id)}
                        disabled={unmuteMemberMutation.isPending}
                        data-testid="button-unmute-member"
                      >
                        <Bell className="h-4 w-4" />
                        Unmute
                      </Button>
                    ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" className="gap-2" data-testid="button-mute-member">
                            <BellOff className="h-4 w-4" />
                            Mute
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem
                            onClick={() => muteMemberMutation.mutate({ memberId: selectedMember.id, scope: "member" })}
                            className="gap-2"
                            data-testid="menu-mute-member-only"
                          >
                            <BellOff className="h-4 w-4" />
                            Mute This Person
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => muteMemberMutation.mutate({ memberId: selectedMember.id, scope: "branch" })}
                            className="gap-2"
                            data-testid="menu-mute-branch"
                          >
                            <GitBranch className="h-4 w-4" />
                            Mute This Branch
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    );
                  })()}
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
                  {canEditTree && (!selectedMember.claimedByUserId || selectedMember.claimedByUserId === user?.id) && (
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
                      onClick={() => {
                        if (confirm("Remove this member? They will be moved to Recently Deleted and can be restored within 30 days.")) {
                          deleteMemberMutation.mutate(selectedMember.id);
                        }
                      }}
                      disabled={deleteMemberMutation.isPending}
                      data-testid="button-delete-member"
                    >
                      <Trash2 className="h-4 w-4" />
                      {deleteMemberMutation.isPending ? "Removing..." : "Remove"}
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {treeData?.tree && (
        <>
          <ShareTreeDialog
            open={isShareOpen}
            onOpenChange={setIsShareOpen}
            treeId={treeData.tree.id}
            treeName={treeData.tree.name}
          />
          <InviteConnectDialog
            open={isInviteConnectOpen}
            onOpenChange={setIsInviteConnectOpen}
            treeId={treeData.tree.id}
            treeName={treeData.tree.name}
            treeType={treeData.tree.treeType || "family"}
          />
          <SmartMatchDialog
            treeId={treeData.tree.id}
            treeName={treeData.tree.name}
            open={isSmartMatchOpen}
            onOpenChange={setIsSmartMatchOpen}
          />
        </>
      )}

      {/* Edit Member Dialog */}
      <Dialog open={isEditMemberOpen} onOpenChange={setIsEditMemberOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit {treeData ? getTreeTypeConfig((treeData.tree.treeType || "family") as TreeType).memberLabel : "Member"}</DialogTitle>
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
      <Dialog open={!!editingRelationship} onOpenChange={(open) => {
        if (!open) {
          setEditingRelationship(null);
          setNewRelationshipType("");
          setNewRelationshipQualifier(null);
          setNewCustomLabel("");
          setIsEditCustomType(false);
          setEditCustomTypeName("");
          setEditCustomReverseLabel("");
          setEditSwapDirection(false);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Relationship</DialogTitle>
          </DialogHeader>
          {editingRelationship && (() => {
            const currentTreeType = (treeData?.tree.treeType || "family") as TreeType;
            const customTypes = treeData?.tree.customRelationshipTypes as (string | { label: string; reverseLabel?: string })[] | null;
            const activeRelType = isEditCustomType 
              ? editCustomTypeName.trim().toLowerCase().replace(/\s+/g, '_') 
              : (newRelationshipType || editingRelationship.currentType);
            const allRelTypes = getRelationshipTypesForTree(currentTreeType, customTypes);
            const activeConfig = allRelTypes.find(rt => rt.value === activeRelType);
            const fromName = editSwapDirection ? editingRelationship.member2Name : editingRelationship.member1Name;
            const toName = editSwapDirection ? editingRelationship.member1Name : editingRelationship.member2Name;
            const fromRoleLabel = isEditCustomType
              ? (editCustomTypeName.trim() || "...")
              : (activeConfig?.label || activeRelType);
            const toRoleLabel = isEditCustomType
              ? (editCustomReverseLabel.trim() || editCustomTypeName.trim() || "...")
              : (activeConfig?.reverseLabel || activeConfig?.label || activeRelType);
            const hasReverse = isEditCustomType 
              ? !!editCustomReverseLabel.trim()
              : !!(activeConfig?.reverseLabel && activeConfig.reverseLabel !== activeConfig.label);
            
            return (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Change the relationship between {editingRelationship.member1Name} and {editingRelationship.member2Name}
              </p>

              {hasReverse && (
                <div className="p-3 border rounded-lg bg-muted/30 space-y-2" data-testid="role-assignment-preview">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Role Assignment</Label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 p-2 rounded-md bg-background border text-center">
                      <p className="text-xs text-muted-foreground">{fromName}</p>
                      <p className="text-sm font-semibold" data-testid="text-from-role">{fromRoleLabel}</p>
                    </div>
                    <Button 
                      variant="outline" 
                      size="icon" 
                      className="h-8 w-8 shrink-0"
                      onClick={() => setEditSwapDirection(!editSwapDirection)}
                      data-testid="button-swap-roles"
                      type="button"
                    >
                      <ArrowLeftRight className="h-4 w-4" />
                    </Button>
                    <div className="flex-1 p-2 rounded-md bg-background border text-center">
                      <p className="text-xs text-muted-foreground">{toName}</p>
                      <p className="text-sm font-semibold" data-testid="text-to-role">{toRoleLabel}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    Use the swap button to change who has which role
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Relationship Type</Label>
                <Select 
                  value={isEditCustomType ? "__custom__" : newRelationshipType} 
                  onValueChange={(val) => {
                    if (val === "__custom__") {
                      setIsEditCustomType(true);
                      setNewRelationshipType("");
                    } else {
                      setIsEditCustomType(false);
                      setEditCustomTypeName("");
                      setNewRelationshipType(val);
                    }
                  }}
                >
                  <SelectTrigger data-testid="select-new-relationship-type">
                    <SelectValue placeholder="Select relationship type" />
                  </SelectTrigger>
                  <SelectContent>
                    {treeData && getRelationshipTypesForTree(
                      currentTreeType,
                      customTypes
                    ).map((relType) => (
                      <SelectItem key={relType.value} value={relType.value}>
                        {relType.label}{relType.description ? ` - ${relType.description}` : ''}
                      </SelectItem>
                    ))}
                    <SelectItem value="__custom__" data-testid="select-edit-custom-type">
                      <span className="flex items-center gap-1.5">
                        <Plus className="h-3.5 w-3.5" />
                        Create custom type...
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
                {isEditCustomType && (
                  <div className="mt-2 p-3 border rounded-md bg-muted/50 space-y-3">
                    <div className="space-y-2">
                      <Label>Custom Relationship Name *</Label>
                      <Input
                        placeholder="e.g. Mentor, Coach, Advisor..."
                        value={editCustomTypeName}
                        onChange={(e) => setEditCustomTypeName(e.target.value)}
                        data-testid="input-edit-custom-type-name"
                        autoFocus
                      />
                      <p className="text-xs text-muted-foreground">
                        This is {fromName}'s role in the relationship.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Other Person's Role (optional)</Label>
                      <Input
                        placeholder="e.g. Mentee, Player, Student..."
                        value={editCustomReverseLabel}
                        onChange={(e) => setEditCustomReverseLabel(e.target.value)}
                        data-testid="input-edit-custom-reverse-label"
                      />
                      <p className="text-xs text-muted-foreground">
                        What {toName} is to {fromName}.
                      </p>
                    </div>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Current: {editingRelationship.currentType}
                </p>
              </div>
              <div className="space-y-2">
                <Label>Relationship Qualifier</Label>
                <Select value={newRelationshipQualifier || ""} onValueChange={(v) => setNewRelationshipQualifier(v || null)}>
                  <SelectTrigger data-testid="select-new-relationship-qualifier">
                    <SelectValue placeholder="Select qualifier (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="biological">Biological</SelectItem>
                    <SelectItem value="step">Step</SelectItem>
                    <SelectItem value="adopted">Adopted</SelectItem>
                    <SelectItem value="foster">Foster</SelectItem>
                    <SelectItem value="half">Half</SelectItem>
                    <SelectItem value="in-law">In-Law</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Current: {editingRelationship.currentQualifier || "None (biological/default)"}
                </p>
              </div>
              <div className="space-y-2">
                <Label>Custom Label / Note</Label>
                <Input
                  placeholder="e.g. Best friend since college, Mentor, etc."
                  value={newCustomLabel}
                  onChange={(e) => setNewCustomLabel(e.target.value)}
                  data-testid="input-custom-label"
                />
                <p className="text-xs text-muted-foreground">
                  Add a personal note or custom label for this relationship. This appears next to the relationship in the member panel.
                </p>
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingRelationship(null);
                    setNewRelationshipType("");
                    setNewRelationshipQualifier(null);
                    setNewCustomLabel("");
                    setIsEditCustomType(false);
                    setEditCustomTypeName("");
                    setEditCustomReverseLabel("");
                    setEditSwapDirection(false);
                  }}
                  data-testid="button-cancel-edit-relationship"
                >
                  Cancel
                </Button>
                <Button
                  onClick={async () => {
                    if (editingRelationship) {
                      let finalType = newRelationshipType;
                      if (isEditCustomType && editCustomTypeName.trim()) {
                        const typeName = editCustomTypeName.trim();
                        finalType = typeName.toLowerCase().replace(/\s+/g, '_');
                        const reverseLabel = editCustomReverseLabel.trim() || undefined;
                        const existing = (treeData?.tree.customRelationshipTypes as (string | { label: string; reverseLabel?: string })[] | null) || [];
                        const alreadyExists = existing.some(t => {
                          const label = typeof t === 'string' ? t : t.label;
                          return label === typeName;
                        });
                        if (!alreadyExists) {
                          const newEntry: string | { label: string; reverseLabel?: string } = reverseLabel 
                            ? { label: typeName, reverseLabel }
                            : typeName;
                          try {
                            await apiRequest("PATCH", `/api/trees/${treeId}`, {
                              customRelationshipTypes: [...existing, newEntry],
                            });
                            queryClient.invalidateQueries({ queryKey: ["/api/trees", treeId] });
                          } catch {
                            toast({
                              title: "Error",
                              description: "Failed to save custom relationship type",
                              variant: "destructive",
                            });
                            return;
                          }
                        }
                      }
                      const hasTypeChange = finalType && finalType !== editingRelationship.currentType;
                      const hasQualifierChange = newRelationshipQualifier !== editingRelationship.currentQualifier;
                      const hasCustomLabelChange = (newCustomLabel || null) !== editingRelationship.currentCustomLabel;
                      if (hasTypeChange || hasQualifierChange || hasCustomLabelChange || editSwapDirection) {
                        updateRelationshipMutation.mutate({
                          relationshipId: editingRelationship.id,
                          newType: finalType || editingRelationship.currentType,
                          newQualifier: newRelationshipQualifier,
                          customLabel: newCustomLabel || null,
                          swapDirection: editSwapDirection,
                        });
                      }
                    }
                  }}
                  disabled={
                    updateRelationshipMutation.isPending ||
                    (isEditCustomType && !editCustomTypeName.trim()) ||
                    (!isEditCustomType && !editSwapDirection && (
                      (!newRelationshipType || newRelationshipType === editingRelationship.currentType) &&
                      newRelationshipQualifier === editingRelationship.currentQualifier &&
                      (newCustomLabel || null) === editingRelationship.currentCustomLabel
                    ))
                  }
                  data-testid="button-save-relationship"
                >
                  {updateRelationshipMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <Dialog open={isBulkRelChangeOpen} onOpenChange={(open) => {
        if (!open) {
          setIsBulkRelChangeOpen(false);
          setBulkRelFromType("");
          setBulkRelToType("");
          setBulkRelExcludeIds(new Set());
        }
      }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bulk Change Relationship Type</DialogTitle>
          </DialogHeader>
          {treeData && (() => {
            const tt = (treeData.tree.treeType || "family") as TreeType;
            const allRelTypes = getRelationshipTypesForTree(tt, treeData.tree.customRelationshipTypes as (string | { label: string; reverseLabel?: string })[] | null);
            const typesInUse = Array.from(new Set(treeData.relationships.map(r => r.relationshipType)));
            const getMember = (id: string) => treeData.members.find(m => m.id === id);
            const getMemberName = (m: FamilyMember | undefined) => m ? (m.lastName ? `${m.firstName} ${m.lastName}` : m.firstName) + (m.suffix ? ` ${m.suffix}` : '') : "Unknown";
            const matchingRels = bulkRelFromType
              ? treeData.relationships.filter(r => r.relationshipType === bulkRelFromType)
              : [];
            const selectedRels = matchingRels.filter(r => !bulkRelExcludeIds.has(r.id));

            return (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Select a relationship type to change, choose which members to include, then pick the new type.
                </p>
                <div className="space-y-2">
                  <Label>Current Relationship Type</Label>
                  <Select value={bulkRelFromType} onValueChange={(v) => { setBulkRelFromType(v); setBulkRelExcludeIds(new Set()); }}>
                    <SelectTrigger data-testid="select-bulk-from-type">
                      <SelectValue placeholder="Select type to change..." />
                    </SelectTrigger>
                    <SelectContent>
                      {typesInUse.map(type => {
                        const config = allRelTypes.find(rt => rt.value === type);
                        const count = treeData.relationships.filter(r => r.relationshipType === type).length;
                        return (
                          <SelectItem key={type} value={type}>
                            {config?.label || type} ({count} relationship{count !== 1 ? 's' : ''})
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                {bulkRelFromType && matchingRels.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Members to Change ({selectedRels.length} of {matchingRels.length} selected)</Label>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setBulkRelExcludeIds(new Set())} data-testid="button-select-all-rels">
                          Select All
                        </Button>
                        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setBulkRelExcludeIds(new Set(matchingRels.map(r => r.id)))} data-testid="button-deselect-all-rels">
                          Deselect All
                        </Button>
                      </div>
                    </div>
                    <div className="border rounded-md max-h-48 overflow-y-auto">
                      {matchingRels.map(rel => {
                        const from = getMember(rel.fromMemberId);
                        const to = getMember(rel.toMemberId);
                        const isExcluded = bulkRelExcludeIds.has(rel.id);
                        return (
                          <label
                            key={rel.id}
                            className={`flex items-center gap-2 px-3 py-2 hover:bg-muted/50 cursor-pointer border-b last:border-0 ${isExcluded ? 'opacity-50' : ''}`}
                            data-testid={`bulk-rel-item-${rel.id}`}
                          >
                            <input
                              type="checkbox"
                              checked={!isExcluded}
                              onChange={() => {
                                const next = new Set(bulkRelExcludeIds);
                                if (isExcluded) next.delete(rel.id);
                                else next.add(rel.id);
                                setBulkRelExcludeIds(next);
                              }}
                              className="rounded"
                            />
                            <span className="text-sm">
                              {getMemberName(from)} → {getMemberName(to)}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {bulkRelFromType && (
                  <div className="space-y-2">
                    <Label>Change To</Label>
                    <Select value={bulkRelToType} onValueChange={setBulkRelToType}>
                      <SelectTrigger data-testid="select-bulk-to-type">
                        <SelectValue placeholder="Select new type..." />
                      </SelectTrigger>
                      <SelectContent>
                        {allRelTypes
                          .filter(rt => rt.value !== bulkRelFromType)
                          .map(rt => (
                            <SelectItem key={rt.value} value={rt.value}>
                              {rt.label}{rt.description ? ` — ${rt.description}` : ''}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="flex gap-2 justify-end pt-2">
                  <Button variant="outline" onClick={() => setIsBulkRelChangeOpen(false)} data-testid="button-cancel-bulk-rel">
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (selectedRels.length > 0 && bulkRelToType) {
                        bulkUpdateRelationshipsMutation.mutate({
                          relationshipIds: selectedRels.map(r => r.id),
                          newRelationshipType: bulkRelToType,
                        });
                      }
                    }}
                    disabled={
                      bulkUpdateRelationshipsMutation.isPending ||
                      !bulkRelFromType ||
                      !bulkRelToType ||
                      selectedRels.length === 0
                    }
                    data-testid="button-apply-bulk-rel"
                  >
                    {bulkUpdateRelationshipsMutation.isPending
                      ? "Updating..."
                      : `Change ${selectedRels.length} Relationship${selectedRels.length !== 1 ? 's' : ''}`}
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <PaymentGateDialog
        open={showPaymentGate}
        onOpenChange={setShowPaymentGate}
        type="credits"
        current={paymentGateInfo.current}
        credits={paymentGateInfo.credits}
      />

      {importConnectionData && treeId && (
        <BranchImportDialog
          isOpen={importDialogOpen}
          onClose={() => {
            setImportDialogOpen(false);
            setImportConnectionData(null);
            setImportPreviewData(null);
          }}
          treeId={treeId}
          connectionId={importConnectionData.connectionId}
          connectorMemberId={importConnectionData.connectorMemberId}
          sourceTreeName={importConnectionData.sourceTreeName}
          onPreviewChange={setImportPreviewData}
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
          currentUserId={user?.id}
        />
      )}

      {selectedMember && treeData && mergedData && showSamePersonPicker && (() => {
        const isFromConnected = (selectedMember as any).isFromConnectedTree;
        const candidateMembers = isFromConnected
          ? treeData.members.filter(m => m.id !== selectedMember.id)
          : mergedData.members.filter(m => (m as any).isFromConnectedTree && m.id !== selectedMember.id);
        const searchLabel = isFromConnected ? "your tree" : "the connected tree";
        return (
          <Dialog open={showSamePersonPicker} onOpenChange={(open) => {
            setShowSamePersonPicker(open);
            if (!open) setSamePersonSearch("");
          }}>
            <DialogContent className="max-w-md max-h-[80vh] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle className="font-serif flex items-center gap-2">
                  <Merge className="h-5 w-5" />
                  Who is {selectedMember.firstName} {selectedMember.lastName || ""} in {searchLabel}?
                </DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                Select the member in {searchLabel} that is the same person as {selectedMember.firstName}.
              </p>
              <Input
                placeholder={`Search ${searchLabel} members...`}
                value={samePersonSearch}
                onChange={(e) => setSamePersonSearch(e.target.value)}
                data-testid="input-same-person-search"
              />
              <ScrollArea className="flex-1 max-h-[40vh]">
                <div className="space-y-1 pr-4">
                  {candidateMembers
                    .filter(m => {
                      if (!samePersonSearch) return true;
                      const q = samePersonSearch.toLowerCase();
                      const name = `${m.firstName} ${m.lastName || ""}`.toLowerCase();
                      const nick = (m.nickname || "").toLowerCase();
                      const email = (m.email || "").toLowerCase();
                      return name.includes(q) || nick.includes(q) || email.includes(q);
                    })
                    .sort((a, b) => {
                      const selectedLast = (selectedMember.lastName || "").toLowerCase();
                      const aMatch = (a.lastName || "").toLowerCase() === selectedLast ? 1 : 0;
                      const bMatch = (b.lastName || "").toLowerCase() === selectedLast ? 1 : 0;
                      return bMatch - aMatch;
                    })
                    .map(m => (
                      <button
                        key={m.id}
                        className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors text-left"
                        onClick={() => {
                          const ownMember = isFromConnected ? m : selectedMember;
                          const connMember = isFromConnected ? selectedMember : m;
                          setCrossTreeMergeData({
                            connectedMember: connMember,
                            ownTreeMember: ownMember,
                            connectedTreeName: (connMember as any).sourceTreeName || "Connected Tree",
                          });
                          setShowSamePersonPicker(false);
                          setIsMemberDetailOpen(false);
                          setTimeout(() => setShowCrossTreeMerge(true), 150);
                        }}
                        data-testid={`button-pick-same-person-${m.id}`}
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={m.photoUrl || undefined} />
                          <AvatarFallback className="bg-primary/10 text-primary text-xs">
                            {m.firstName[0]}{m.lastName?.[0] || ""}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{m.firstName} {m.lastName || ""}</p>
                          <div className="flex items-center gap-2">
                            {m.birthDate && (
                              <p className="text-xs text-muted-foreground">
                                b. {new Date(m.birthDate).getFullYear()}
                              </p>
                            )}
                            {(m as any).sourceTreeName && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0">
                                {(m as any).sourceTreeName}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </button>
                    ))
                  }
                  {candidateMembers.filter(m => {
                    if (!samePersonSearch) return true;
                    const name = `${m.firstName} ${m.lastName || ""}`.toLowerCase();
                    return name.includes(samePersonSearch.toLowerCase());
                  }).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">No matching members found</p>
                  )}
                </div>
              </ScrollArea>
            </DialogContent>
          </Dialog>
        );
      })()}

      {crossTreeMergeData && (
        <MemberMergeDialog
          open={showCrossTreeMerge}
          onOpenChange={(open) => {
            setShowCrossTreeMerge(open);
            if (!open) setCrossTreeMergeData(null);
          }}
          memberA={crossTreeMergeData.ownTreeMember}
          memberB={crossTreeMergeData.connectedMember}
          memberATreeName={treeData?.tree.name}
          memberBTreeName={crossTreeMergeData.connectedTreeName}
          onMergeComplete={() => {
            setShowCrossTreeMerge(false);
            setCrossTreeMergeData(null);
            queryClient.invalidateQueries({ queryKey: ["/api/trees", treeId, "merged"] });
            queryClient.invalidateQueries({ queryKey: ["/api/trees", treeId] });
          }}
        />
      )}

      <Dialog open={isCreateSubgroupOpen} onOpenChange={(open) => {
        setIsCreateSubgroupOpen(open);
        if (!open) setNewSubgroupName("");
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif flex items-center gap-2">
              <GitBranch className="h-5 w-5" />
              Create Sub-group
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Create a smaller group within "{treeData?.tree.name}". 
              Examples: graduating classes (Class of 2025), subject groups (Math, History), teams, or committees.
            </p>
            <div className="space-y-2">
              <Label htmlFor="subgroup-name">Sub-group Name</Label>
              <Input
                id="subgroup-name"
                value={newSubgroupName}
                onChange={(e) => setNewSubgroupName(e.target.value)}
                placeholder="e.g. Class of 2025, History Department"
                data-testid="input-subgroup-name"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newSubgroupName.trim()) {
                    createSubgroupMutation.mutate({ name: newSubgroupName.trim() });
                  }
                }}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsCreateSubgroupOpen(false)} data-testid="button-cancel-subgroup">
                Cancel
              </Button>
              <Button
                onClick={() => createSubgroupMutation.mutate({ name: newSubgroupName.trim() })}
                disabled={!newSubgroupName.trim() || createSubgroupMutation.isPending}
                data-testid="button-submit-subgroup"
              >
                {createSubgroupMutation.isPending ? "Creating..." : "Create Sub-group"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isMoveUnderParentOpen} onOpenChange={(open) => {
        setIsMoveUnderParentOpen(open);
        if (!open) setSelectedParentTreeId("");
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif flex items-center gap-2">
              <GitBranch className="h-5 w-5" />
              Move Under Parent
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Move "{treeData?.tree.name}" under another group you own, making it a sub-group. 
              You must own or co-own both trees.
            </p>
            {treeData?.parentTree && (
              <p className="text-sm text-amber-600 dark:text-amber-400">
                This tree is currently under "{treeData.parentTree.name}". Selecting a new parent will move it there instead.
              </p>
            )}
            <div className="space-y-2">
              <Label>Select Parent Group</Label>
              <Select value={selectedParentTreeId} onValueChange={setSelectedParentTreeId}>
                <SelectTrigger data-testid="select-parent-tree">
                  <SelectValue placeholder="Choose a group..." />
                </SelectTrigger>
                <SelectContent>
                  {allUserTrees
                    ?.filter(t => t.id !== treeId)
                    .map(t => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                        {t.parentTreeId ? " (sub-group)" : ""}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsMoveUnderParentOpen(false)} data-testid="button-cancel-move-parent">
                Cancel
              </Button>
              <Button
                onClick={() => moveTreeParentMutation.mutate(selectedParentTreeId)}
                disabled={!selectedParentTreeId || moveTreeParentMutation.isPending}
                data-testid="button-submit-move-parent"
              >
                {moveTreeParentMutation.isPending ? "Moving..." : "Move Tree"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isSplitTreeOpen} onOpenChange={(open) => {
        setIsSplitTreeOpen(open);
        if (!open) {
          setSplitTreeName("");
          setSplitSelectedMembers(new Set());
          setSplitNewOwnerId("");
          setSplitRootMemberId("");
          setSplitKeepLinked(true);
          setSplitMemberSearch("");
        }
      }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif flex items-center gap-2">
              <Scissors className="h-5 w-5" />
              Split Tree
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Move selected members into a new separate tree. Relationships between members staying and leaving will be removed. All member data is preserved.
            </p>

            <div className="space-y-2">
              <Label>New Tree Name</Label>
              <Input
                value={splitTreeName}
                onChange={(e) => setSplitTreeName(e.target.value)}
                placeholder="Enter name for the new tree..."
                data-testid="input-split-tree-name"
              />
            </div>

            <div className="space-y-2">
              <Label>New Owner</Label>
              <Select value={splitNewOwnerId} onValueChange={setSplitNewOwnerId}>
                <SelectTrigger data-testid="select-split-owner">
                  <SelectValue placeholder="Select owner..." />
                </SelectTrigger>
                <SelectContent>
                  {userId && (
                    <SelectItem value={userId}>
                      {user?.firstName} {user?.lastName} (You)
                    </SelectItem>
                  )}
                  {collaborators
                    ?.filter(c => c.userId !== userId)
                    .map(c => (
                      <SelectItem key={c.userId} value={c.userId}>
                        {c.userId} ({c.role})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Select Members to Move ({splitSelectedMembers.size} selected)</Label>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const all = new Set(treeData?.members?.map(m => m.id) || []);
                      setSplitSelectedMembers(all);
                    }}
                    data-testid="button-select-all-members"
                  >
                    All
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSplitSelectedMembers(new Set())}
                    data-testid="button-deselect-all-members"
                  >
                    None
                  </Button>
                </div>
              </div>
              <Input
                placeholder="Search members..."
                value={splitMemberSearch}
                onChange={(e) => setSplitMemberSearch(e.target.value)}
                className="mb-2"
                data-testid="input-split-member-search"
              />
              <ScrollArea className="h-48 rounded-md border p-2">
                {treeData?.members
                  ?.filter(m => {
                    if (!splitMemberSearch) return true;
                    const q = splitMemberSearch.toLowerCase();
                    return (
                      m.firstName?.toLowerCase().includes(q) ||
                      m.lastName?.toLowerCase().includes(q) ||
                      m.email?.toLowerCase().includes(q)
                    );
                  })
                  .map(member => (
                    <div
                      key={member.id}
                      className="flex items-center gap-2 py-1.5 px-1 hover:bg-muted/50 rounded"
                      data-testid={`split-member-row-${member.id}`}
                    >
                      <Checkbox
                        checked={splitSelectedMembers.has(member.id)}
                        onCheckedChange={(checked) => {
                          const next = new Set(splitSelectedMembers);
                          if (checked) {
                            next.add(member.id);
                          } else {
                            next.delete(member.id);
                            if (splitRootMemberId === member.id) {
                              setSplitRootMemberId("");
                            }
                          }
                          setSplitSelectedMembers(next);
                        }}
                        data-testid={`checkbox-split-member-${member.id}`}
                      />
                      <span className="text-sm flex-1">
                        {member.firstName} {member.lastName || ""}
                        {member.email ? ` (${member.email})` : ""}
                      </span>
                    </div>
                  ))}
                {treeData?.members?.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No members in this tree</p>
                )}
              </ScrollArea>
            </div>

            {splitSelectedMembers.size > 0 && (
              <div className="space-y-2">
                <Label>Root Member for New Tree (optional)</Label>
                <Select value={splitRootMemberId} onValueChange={setSplitRootMemberId}>
                  <SelectTrigger data-testid="select-split-root-member">
                    <SelectValue placeholder="Choose a root member..." />
                  </SelectTrigger>
                  <SelectContent>
                    {treeData?.members
                      ?.filter(m => splitSelectedMembers.has(m.id))
                      .map(m => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.firstName} {m.lastName || ""}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Switch
                checked={splitKeepLinked}
                onCheckedChange={setSplitKeepLinked}
                data-testid="switch-keep-linked"
              />
              <Label className="text-sm">Keep trees linked after split</Label>
            </div>

            {splitSelectedMembers.size > 0 && splitSelectedMembers.size >= (treeData?.members?.length || 0) && (
              <p className="text-sm text-destructive">
                You must leave at least one member in the original tree.
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsSplitTreeOpen(false)} data-testid="button-cancel-split">
                Cancel
              </Button>
              <Button
                onClick={() => {
                  splitTreeMutation.mutate({
                    name: splitTreeName,
                    memberIds: Array.from(splitSelectedMembers),
                    newOwnerId: splitNewOwnerId || undefined,
                    rootMemberId: splitRootMemberId || undefined,
                    createConnection: splitKeepLinked,
                  });
                }}
                disabled={
                  !splitTreeName.trim() ||
                  splitSelectedMembers.size === 0 ||
                  splitSelectedMembers.size >= (treeData?.members?.length || 0) ||
                  splitTreeMutation.isPending
                }
                data-testid="button-submit-split"
              >
                {splitTreeMutation.isPending ? "Splitting..." : "Split Tree"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isCloneTreeOpen} onOpenChange={(open) => {
        setIsCloneTreeOpen(open);
        if (!open) setCloneTreeName("");
      }}>
        <DialogContent className="max-w-md" data-testid="dialog-clone-tree">
          <DialogHeader>
            <DialogTitle>Clone Tree</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Create a copy of this tree with all members and relationships. You can then remove or add members as needed.
            </p>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="clone-tree-name">New Tree Name</Label>
              <Input
                id="clone-tree-name"
                value={cloneTreeName}
                onChange={(e) => setCloneTreeName(e.target.value)}
                placeholder="Enter name for the cloned tree"
                data-testid="input-clone-tree-name"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {treeData?.members?.length || 0} members and all relationships will be copied to the new tree.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsCloneTreeOpen(false)} data-testid="button-cancel-clone">
                Cancel
              </Button>
              <Button
                onClick={() => cloneTreeMutation.mutate({ name: cloneTreeName })}
                disabled={!cloneTreeName.trim() || cloneTreeMutation.isPending}
                data-testid="button-submit-clone"
              >
                {cloneTreeMutation.isPending ? "Cloning..." : "Clone Tree"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isTagDialogOpen} onOpenChange={(open) => {
        setIsTagDialogOpen(open);
        if (!open) { setNewTagLabel(""); setNewTagColor("#6366f1"); setBulkTagId(""); setBulkSelectedMembers(new Set()); setBulkTagSearch(""); setCreateTreeTagId(""); setCreateTreeName(""); setEmailTagId(""); setEmailSubject(""); setEmailMessage(""); }
      }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Tags</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Create New Tag</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. Class of 2025, Chapter Alpha"
                  value={newTagLabel}
                  onChange={(e) => setNewTagLabel(e.target.value)}
                  maxLength={50}
                  className="flex-1"
                  data-testid="input-tag-label"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newTagLabel.trim()) {
                      addTagMutation.mutate({ label: newTagLabel.trim(), color: newTagColor });
                    }
                  }}
                />
                <input
                  type="color"
                  value={newTagColor}
                  onChange={(e) => setNewTagColor(e.target.value)}
                  className="w-10 h-10 rounded border cursor-pointer"
                  data-testid="input-tag-color"
                />
                <Button
                  size="sm"
                  onClick={() => addTagMutation.mutate({ label: newTagLabel.trim(), color: newTagColor })}
                  disabled={!newTagLabel.trim() || addTagMutation.isPending}
                  data-testid="button-add-tag"
                >
                  Add
                </Button>
              </div>
              <div className="flex gap-2">
                {["#6366f1", "#f43f5e", "#10b981", "#f59e0b", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6"].map((c) => (
                  <button
                    key={c}
                    className="w-6 h-6 rounded-full border-2 transition-all"
                    style={{ backgroundColor: c, borderColor: newTagColor === c ? "currentColor" : "transparent" }}
                    onClick={() => setNewTagColor(c)}
                    data-testid={`button-color-${c.replace("#", "")}`}
                  />
                ))}
              </div>
            </div>

            {treeData?.tags && treeData.tags.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Current Tags</Label>
                <div className="space-y-2">
                  {treeData.tags.map((tag) => {
                    const memberCount = treeData.memberTags?.filter(mt => mt.tagId === tag.id).length || 0;
                    const emailCount = allDisplayMembers.filter(m => {
                      const isTagged = treeData.memberTags?.some(mt => mt.tagId === tag.id && mt.memberId === m.id);
                      return isTagged && m.email;
                    }).length;
                    return (
                      <div key={tag.id} className="rounded-lg border border-border p-2 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Badge
                            variant={bulkTagId === tag.id ? "default" : "outline"}
                            className="text-sm gap-1.5 px-3 py-1 cursor-pointer"
                            style={bulkTagId === tag.id
                              ? { backgroundColor: tag.color || "#6366f1", borderColor: tag.color || "#6366f1" }
                              : { borderColor: tag.color || "#6366f1", color: tag.color || "#6366f1" }}
                            onClick={() => {
                              if (bulkTagId === tag.id) {
                                setBulkTagId("");
                                setBulkSelectedMembers(new Set());
                              } else {
                                setBulkTagId(tag.id);
                                const assigned = new Set(
                                  treeData.memberTags?.filter(mt => mt.tagId === tag.id).map(mt => mt.memberId) || []
                                );
                                setBulkSelectedMembers(assigned);
                              }
                            }}
                            data-testid={`dialog-tag-${tag.id}`}
                          >
                            {tag.label} ({memberCount})
                          </Badge>
                          <button
                            className="text-muted-foreground hover:text-destructive text-xs"
                            onClick={() => { deleteTagMutation.mutate(tag.id); if (bulkTagId === tag.id) setBulkTagId(""); }}
                            data-testid={`button-dialog-delete-tag-${tag.id}`}
                          >
                            ×
                          </button>
                        </div>
                        {memberCount > 0 && (
                          <div className="flex items-center gap-1 pl-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs gap-1 px-2"
                                  onClick={() => { setFilterTagId(tag.id); setIsTagDialogOpen(false); }}
                                  data-testid={`button-filter-tag-${tag.id}`}
                                >
                                  <Filter className="h-3 w-3" />
                                  Filter View
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Show only members with this tag</TooltipContent>
                            </Tooltip>
                            {(isOwner || isCoOwner) && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs gap-1 px-2"
                                    onClick={() => { setCreateTreeTagId(tag.id); setCreateTreeName(tag.label); }}
                                    data-testid={`button-create-tree-tag-${tag.id}`}
                                  >
                                    <TreeDeciduous className="h-3 w-3" />
                                    Create Tree
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Create a new tree with these tagged members</TooltipContent>
                              </Tooltip>
                            )}
                            {emailCount > 0 && canEditTree && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs gap-1 px-2"
                                    onClick={() => { setEmailTagId(tag.id); setEmailSubject(""); setEmailMessage(""); }}
                                    data-testid={`button-email-tag-${tag.id}`}
                                  >
                                    <Mail className="h-3 w-3" />
                                    Email ({emailCount})
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Send an email to all tagged members with email addresses</TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {bulkTagId && treeData?.tags && (
              <div className="space-y-3 border rounded-lg p-3" data-testid="bulk-assign-section">
                <Label className="text-sm font-medium">
                  Assign "{treeData.tags.find(t => t.id === bulkTagId)?.label}" to Members
                </Label>
                <Input
                  placeholder="Search members..."
                  value={bulkTagSearch}
                  onChange={(e) => setBulkTagSearch(e.target.value)}
                  className="text-sm"
                  data-testid="input-bulk-tag-search"
                />
                <ScrollArea className="h-48">
                  <div className="space-y-1">
                    {allDisplayMembers
                      .filter(m => !bulkTagSearch || `${m.firstName} ${m.lastName}`.toLowerCase().includes(bulkTagSearch.toLowerCase()))
                      .map((member) => (
                        <label key={member.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-muted cursor-pointer">
                          <Checkbox
                            checked={bulkSelectedMembers.has(member.id)}
                            onCheckedChange={(checked) => {
                              const next = new Set(bulkSelectedMembers);
                              if (checked) next.add(member.id);
                              else next.delete(member.id);
                              setBulkSelectedMembers(next);
                            }}
                            data-testid={`checkbox-bulk-member-${member.id}`}
                          />
                          <span className="text-sm">{member.firstName} {member.lastName || ""}</span>
                        </label>
                      ))}
                  </div>
                </ScrollArea>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">
                    {bulkSelectedMembers.size} member{bulkSelectedMembers.size !== 1 ? "s" : ""} selected
                  </span>
                  <Button
                    size="sm"
                    onClick={() => {
                      const currentlyAssigned = new Set(
                        treeData.memberTags?.filter(mt => mt.tagId === bulkTagId).map(mt => mt.memberId) || []
                      );
                      const toAdd = [...bulkSelectedMembers].filter(id => !currentlyAssigned.has(id));
                      const toRemove = [...currentlyAssigned].filter(id => !bulkSelectedMembers.has(id));
                      if (toAdd.length > 0) {
                        bulkAssignTagMutation.mutate({ tagId: bulkTagId, memberIds: toAdd });
                      }
                      toRemove.forEach(memberId => {
                        removeMemberTagMutation.mutate({ memberId, tagId: bulkTagId });
                      });
                      if (toAdd.length === 0 && toRemove.length === 0) {
                        toast({ title: "No changes" });
                      }
                    }}
                    disabled={bulkAssignTagMutation.isPending}
                    data-testid="button-apply-bulk-tags"
                  >
                    {bulkAssignTagMutation.isPending ? "Saving..." : "Apply"}
                  </Button>
                </div>
              </div>
            )}
            {createTreeTagId && treeData?.tags && (
              <div className="space-y-3 border rounded-lg p-3" data-testid="create-tree-from-tag-section">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <TreeDeciduous className="h-4 w-4" />
                  Create Tree from "{treeData.tags.find(t => t.id === createTreeTagId)?.label}"
                </Label>
                <p className="text-xs text-muted-foreground">
                  This will move the {treeData.memberTags?.filter(mt => mt.tagId === createTreeTagId).length || 0} tagged member(s) into a new tree. They will be removed from this tree.
                </p>
                <div className="space-y-2">
                  <Input
                    placeholder="New tree name"
                    value={createTreeName}
                    onChange={(e) => setCreateTreeName(e.target.value)}
                    data-testid="input-create-tree-name"
                  />
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Switch
                      checked={createTreeAsSubGroup}
                      onCheckedChange={setCreateTreeAsSubGroup}
                      data-testid="switch-create-as-subgroup"
                    />
                    Create as sub-group of this tree
                  </label>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setCreateTreeTagId(""); setCreateTreeName(""); }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    disabled={!createTreeName.trim() || createTreeFromTagMutation.isPending}
                    onClick={() => createTreeFromTagMutation.mutate({
                      tagId: createTreeTagId,
                      name: createTreeName.trim(),
                      createAsSubGroup: createTreeAsSubGroup,
                    })}
                    data-testid="button-confirm-create-tree"
                  >
                    {createTreeFromTagMutation.isPending ? "Creating..." : "Create Tree"}
                  </Button>
                </div>
              </div>
            )}

            {emailTagId && treeData?.tags && (
              <div className="space-y-3 border rounded-lg p-3" data-testid="email-tag-group-section">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <Mail className="h-4 w-4" />
                  Email "{treeData.tags.find(t => t.id === emailTagId)?.label}" Group
                </Label>
                <p className="text-xs text-muted-foreground">
                  Send an email to all tagged members who have an email address on file.
                </p>
                <div className="space-y-2">
                  <Input
                    placeholder="Subject line"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    data-testid="input-email-subject"
                  />
                  <Textarea
                    placeholder="Write your message here..."
                    value={emailMessage}
                    onChange={(e) => setEmailMessage(e.target.value)}
                    rows={4}
                    className="resize-none"
                    data-testid="textarea-email-message"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setEmailTagId(""); setEmailSubject(""); setEmailMessage(""); }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    disabled={!emailSubject.trim() || !emailMessage.trim() || emailTagGroupMutation.isPending}
                    onClick={() => emailTagGroupMutation.mutate({
                      tagId: emailTagId,
                      subject: emailSubject.trim(),
                      message: emailMessage.trim(),
                    })}
                    data-testid="button-send-tag-email"
                  >
                    <Send className="h-3.5 w-3.5 mr-1" />
                    {emailTagGroupMutation.isPending ? "Sending..." : "Send Email"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {treeId && (
        <MemberPoolDialog
          isOpen={isMemberPoolOpen}
          onClose={() => setIsMemberPoolOpen(false)}
          treeId={treeId}
        />
      )}

      {isBulkUploadOpen && treeData && (
        <BulkUploadDialog
          treeId={treeId}
          treeName={treeData.tree.name}
          open={isBulkUploadOpen}
          onOpenChange={setIsBulkUploadOpen}
        />
      )}

      <Dialog open={isDeletedMembersOpen} onOpenChange={setIsDeletedMembersOpen}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Deleted Members
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {deletedMembers && deletedMembers.length > 0 ? (
              deletedMembers.map((member: any) => {
                const deletedDate = new Date(member.deletedAt);
                const expiryDate = new Date(deletedDate.getTime() + 30 * 24 * 60 * 60 * 1000);
                const daysLeft = Math.max(0, Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
                const birthYear = member.birthDate ? new Date(member.birthDate).getFullYear() : null;
                const deathYear = member.deathDate ? new Date(member.deathDate).getFullYear() : null;
                const dateRange = birthYear
                  ? deathYear ? `${birthYear} – ${deathYear}` : `b. ${birthYear}`
                  : null;
                const badges: string[] = member.relationshipBadges || [];
                const savedRels: number = member.savedRelationshipCount || 0;
                return (
                  <div key={member.id} className="flex flex-col gap-2 p-3 rounded-lg border bg-card" data-testid={`deleted-member-${member.id}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar className="h-10 w-10 flex-shrink-0">
                          <AvatarImage src={member.photoUrl || undefined} />
                          <AvatarFallback className="text-xs">
                            {(member.firstName?.[0] || "") + (member.lastName?.[0] || "")}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{member.firstName} {member.lastName}</p>
                          <div className="flex items-center gap-2 flex-wrap">
                            {dateRange && (
                              <span className="text-xs text-muted-foreground">{dateRange}</span>
                            )}
                            <span className="text-xs text-muted-foreground">{daysLeft}d left</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => restoreMemberMutation.mutate(member.id)}
                              disabled={restoreMemberMutation.isPending}
                              data-testid={`button-restore-member-${member.id}`}
                            >
                              <Undo2 className="h-4 w-4 text-green-600" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Restore member{savedRels > 0 ? ` with ${savedRels} relationship${savedRels > 1 ? 's' : ''}` : ''}</p>
                          </TooltipContent>
                        </Tooltip>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            if (confirm("Permanently delete this member? This cannot be undone.")) {
                              permanentDeleteMemberMutation.mutate(member.id);
                            }
                          }}
                          disabled={permanentDeleteMemberMutation.isPending}
                          data-testid={`button-permanent-delete-member-${member.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                    {(badges.length > 0 || savedRels > 0) && (
                      <div className="flex items-center gap-1.5 flex-wrap pl-13">
                        {savedRels > 0 && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {savedRels} relationship{savedRels > 1 ? 's' : ''} saved
                          </Badge>
                        )}
                        {badges.slice(0, 3).map((badge: string, idx: number) => (
                          <Badge key={idx} variant="outline" className="text-[10px] px-1.5 py-0">
                            {badge}
                          </Badge>
                        ))}
                        {badges.length > 3 && (
                          <span className="text-[10px] text-muted-foreground">+{badges.length - 3} more</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No deleted members</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
