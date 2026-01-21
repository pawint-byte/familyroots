import { useState, useEffect, useRef, useCallback } from "react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/theme-toggle";
import { SEO } from "@/components/seo";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Trees, Plus, Search, ArrowLeft, ZoomIn, ZoomOut, Maximize2, 
  Users, Calendar, MapPin, Heart, User, Edit, Trash2, Share2,
  ChevronRight, Filter, Download, Upload, Clock
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import type { FamilyTree, FamilyMember, Relationship, InsertFamilyMember } from "@shared/schema";
import FamilyTreeVisualization from "@/components/family-tree-visualization";
import MemberForm from "@/components/member-form";
import { NameHistorySection } from "@/components/name-history";
import { MemberDiscoverability } from "@/components/member-discoverability";
import { MatchRequests } from "@/components/match-requests";
import { EducationHistorySection } from "@/components/education-history";
import { CareerHistorySection } from "@/components/career-history";
import { ShareTreeDialog } from "@/components/share-tree-dialog";
import TimelineView from "@/components/timeline-view";
import { RelationshipDisplay, FocusMemberSelector } from "@/components/relationship-display";

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
  const [focusMember, setFocusMember] = useState<FamilyMember | null>(null);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [isMemberDetailOpen, setIsMemberDetailOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [zoom, setZoom] = useState(1);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [newTreeName, setNewTreeName] = useState("");
  const [isShareOpen, setIsShareOpen] = useState(false);

  const treeId = params?.id;

  const { data: treeData, isLoading, error } = useQuery<TreeData>({
    queryKey: ["/api/trees", treeId],
    enabled: !!treeId,
  });

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
  const canEdit = isOwner || isCoOwner || isEditor;

  const addMemberMutation = useMutation({
    mutationFn: async (data: InsertFamilyMember) => {
      return apiRequest("POST", `/api/trees/${treeId}/members`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trees", treeId] });
      setIsAddMemberOpen(false);
      toast({
        title: "Success",
        description: "Family member added successfully!",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add family member",
        variant: "destructive",
      });
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
    <div className="min-h-screen bg-background flex flex-col">
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
                <DropdownMenuItem className="gap-2">
                  <Download className="h-4 w-4" />
                  Export GEDCOM
                </DropdownMenuItem>
                {canEdit && (
                  <DropdownMenuItem className="gap-2">
                    <Upload className="h-4 w-4" />
                    Import GEDCOM
                  </DropdownMenuItem>
                )}
                {(isOwner || isCoOwner) && (
                  <>
                    <DropdownMenuSeparator />
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
              </DropdownMenuContent>
            </DropdownMenu>
            <ThemeToggle />
            {canEdit && (
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

          <TabsContent value="tree" className="flex-1 m-0 relative">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Trees className="h-12 w-12 text-muted-foreground mx-auto mb-4 animate-pulse" />
                  <p className="text-muted-foreground">Loading family tree...</p>
                </div>
              </div>
            ) : treeData?.members && treeData.members.length > 0 ? (
              <>
                {/* Focus Member Selector */}
                <div className="absolute top-4 left-4 z-10 bg-background/95 backdrop-blur rounded-lg p-3 shadow-lg border" data-testid="focus-selector-container">
                  <FocusMemberSelector
                    members={treeData.members}
                    focusMember={focusMember}
                    onSelectFocus={setFocusMember}
                  />
                  {focusMember && selectedMember && treeId && (
                    <RelationshipDisplay
                      treeId={treeId}
                      focusMember={focusMember}
                      selectedMember={selectedMember}
                      onClearFocus={() => setFocusMember(null)}
                    />
                  )}
                </div>
                <FamilyTreeVisualization
                  members={treeData.members}
                  relationships={treeData.relationships || []}
                  zoom={zoom}
                  onMemberClick={handleMemberClick}
                />
                <div className="absolute bottom-4 right-4 flex flex-col gap-2">
                  <Button 
                    variant="secondary" 
                    size="icon" 
                    onClick={() => setZoom(z => Math.min(z + 0.2, 2))}
                    data-testid="button-zoom-in"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="secondary" 
                    size="icon" 
                    onClick={() => setZoom(z => Math.max(z - 0.2, 0.4))}
                    data-testid="button-zoom-out"
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="secondary" 
                    size="icon" 
                    onClick={() => setZoom(1)}
                    data-testid="button-zoom-reset"
                  >
                    <Maximize2 className="h-4 w-4" />
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full">
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
                            {member.firstName} {member.lastName || ""}
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
                      {selectedMember.firstName} {selectedMember.lastName || ""}
                    </SheetTitle>
                    <div className="flex items-center gap-2">
                      {selectedMember.gender && (
                        <Badge variant="secondary" className="capitalize">
                          {selectedMember.gender}
                        </Badge>
                      )}
                      {selectedMember.isLiving === false && (
                        <Badge variant="outline">Deceased</Badge>
                      )}
                    </div>
                  </div>
                </div>
              </SheetHeader>

              {/* Relationship to focus person */}
              {focusMember && treeId && focusMember.id !== selectedMember.id && (
                <RelationshipDisplay
                  treeId={treeId}
                  focusMember={focusMember}
                  selectedMember={selectedMember}
                  onClearFocus={() => setFocusMember(null)}
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

                <div className="flex gap-2 pt-4 border-t border-border flex-wrap">
                  <Button 
                    variant={focusMember?.id === selectedMember.id ? "default" : "outline"} 
                    className="gap-2"
                    onClick={() => setFocusMember(focusMember?.id === selectedMember.id ? null : selectedMember)}
                    data-testid="button-set-focus"
                  >
                    <User className="h-4 w-4" />
                    {focusMember?.id === selectedMember.id ? "Focus Set" : "Set as Focus"}
                  </Button>
                  <Button variant="outline" className="flex-1 gap-2" data-testid="button-edit-member">
                    <Edit className="h-4 w-4" />
                    Edit
                  </Button>
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

      {/* Match Requests Section - visible to tree owner/editors */}
      {treeData?.tree && canEdit && (
        <div className="fixed bottom-4 right-4 z-40 w-80" data-testid="match-requests-panel">
          <MatchRequests treeId={treeData.tree.id} canEdit={canEdit} />
        </div>
      )}
    </div>
  );
}
