import { useState, useRef, useMemo, useCallback } from "react";
import { useQuery, useQueries } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { toPng } from "html-to-image";
import { Download, ShoppingBag, Users, Eye, Share2, Loader2, Filter, ArrowLeft, List, Printer, Copy, Check, Search, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { getTreeTypeConfig, type TreeType } from "@shared/treeTypes";

interface TreeItem {
  id: string;
  name: string;
  treeType: string | null;
  memberCount: number;
}

interface TreeDetailData {
  tree: TreeItem & { [key: string]: any };
  members: Array<{
    id: string;
    firstName: string;
    lastName: string | null;
    photoUrl: string | null;
    [key: string]: any;
  }>;
  relationships: any[];
}

interface SharedConnection {
  name: string;
  photoUrl: string | null;
  matchType: "email" | "name_and_date" | "name_only";
  appearances: Array<{
    treeId: string;
    treeName: string;
    treeType: string;
    memberId: string;
  }>;
}

function getMatchBadgeVariant(matchType: string): "default" | "secondary" | "outline" {
  if (matchType === "email") return "default";
  if (matchType === "name_and_date") return "secondary";
  return "outline";
}

function getMatchLabel(matchType: string): string {
  if (matchType === "email") return "Email Match";
  if (matchType === "name_and_date") return "Name + Date Match";
  return "Name Match";
}

export default function NetworkOverview() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("hub");
  const [selectedTreeId, setSelectedTreeId] = useState<string>("");
  const [isExporting, setIsExporting] = useState(false);
  const [visibleTreeIds, setVisibleTreeIds] = useState<Set<string> | null>(null);
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const [memberSearch, setMemberSearch] = useState("");

  const hubRef = useRef<HTMLDivElement>(null);
  const expandedRef = useRef<HTMLDivElement>(null);
  const sharedRef = useRef<HTMLDivElement>(null);
  const allMembersRef = useRef<HTMLDivElement>(null);

  const { data: trees, isLoading: treesLoading } = useQuery<TreeItem[]>({
    queryKey: ["/api/trees"],
  });

  const activeVisibleIds = useMemo(() => {
    if (!trees) return new Set<string>();
    if (visibleTreeIds === null) return new Set(trees.map(t => t.id));
    return visibleTreeIds;
  }, [trees, visibleTreeIds]);

  const filteredTrees = useMemo(() => {
    return trees?.filter(t => activeVisibleIds.has(t.id)) ?? [];
  }, [trees, activeVisibleIds]);

  const toggleTreeVisibility = (treeId: string) => {
    setVisibleTreeIds(prev => {
      const current = prev ?? new Set(trees?.map(t => t.id) ?? []);
      const next = new Set(current);
      if (next.has(treeId)) {
        next.delete(treeId);
      } else {
        next.add(treeId);
      }
      return next;
    });
    setSelectedMemberIds(new Set());
  };

  const showAll = () => {
    setVisibleTreeIds(null);
    setSelectedMemberIds(new Set());
  };
  const isAllVisible = visibleTreeIds === null || (trees && visibleTreeIds.size === trees.length);

  const { data: treeDetail, isLoading: treeDetailLoading } = useQuery<TreeDetailData>({
    queryKey: ["/api/trees", selectedTreeId],
    enabled: !!selectedTreeId,
  });

  const { data: sharedConnections, isLoading: sharedLoading } = useQuery<SharedConnection[]>({
    queryKey: ["/api/network/shared"],
  });

  const allTreeQueries = useQueries({
    queries: (filteredTrees ?? []).map(tree => ({
      queryKey: ["/api/trees", tree.id],
      enabled: activeTab === "all-members" && !!tree.id,
    })),
  });

  const allTreesLoading = allTreeQueries.some(q => q.isLoading);

  interface CombinedMember {
    id: string;
    uniqueKey: string;
    firstName: string;
    lastName: string | null;
    photoUrl: string | null;
    email: string | null;
    phone: string | null;
    treeId: string;
    treeName: string;
    treeType: string;
  }

  const allMembers = useMemo<CombinedMember[]>(() => {
    const members: CombinedMember[] = [];
    allTreeQueries.forEach((q, idx) => {
      if (!q.data) return;
      const detail = q.data as TreeDetailData;
      const tree = filteredTrees[idx];
      if (!tree) return;
      detail.members.forEach(m => {
        members.push({
          id: m.id,
          uniqueKey: `${tree.id}-${m.id}`,
          firstName: m.firstName,
          lastName: m.lastName,
          photoUrl: m.photoUrl,
          email: (m as any).email || null,
          phone: (m as any).phone || null,
          treeId: tree.id,
          treeName: tree.name,
          treeType: tree.treeType || "custom",
        });
      });
    });
    return members;
  }, [allTreeQueries, filteredTrees]);

  const filteredMembers = useMemo(() => {
    if (!memberSearch.trim()) return allMembers;
    const q = memberSearch.toLowerCase();
    return allMembers.filter(m =>
      m.firstName.toLowerCase().includes(q) ||
      (m.lastName && m.lastName.toLowerCase().includes(q)) ||
      m.treeName.toLowerCase().includes(q)
    );
  }, [allMembers, memberSearch]);

  const toggleMemberSelection = useCallback((uniqueKey: string) => {
    setSelectedMemberIds(prev => {
      const next = new Set(prev);
      if (next.has(uniqueKey)) {
        next.delete(uniqueKey);
      } else {
        next.add(uniqueKey);
      }
      return next;
    });
  }, []);

  const selectAllVisible = useCallback(() => {
    setSelectedMemberIds(new Set(filteredMembers.map(m => m.uniqueKey)));
  }, [filteredMembers]);

  const clearSelection = useCallback(() => {
    setSelectedMemberIds(new Set());
  }, []);

  const handlePrintSelected = useCallback(() => {
    const selected = allMembers.filter(m => selectedMemberIds.has(m.uniqueKey));
    if (selected.length === 0) {
      toast({ title: "No members selected", description: "Select members first to print.", variant: "destructive" });
      return;
    }

    const grouped = new Map<string, CombinedMember[]>();
    selected.forEach(m => {
      const list = grouped.get(m.treeName) || [];
      list.push(m);
      grouped.set(m.treeName, list);
    });

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    let html = `<!DOCTYPE html><html><head><title>My Network - Selected Members</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 40px; color: #333; }
      h1 { font-size: 24px; margin-bottom: 8px; }
      h2 { font-size: 18px; margin: 24px 0 12px; padding-bottom: 6px; border-bottom: 2px solid #e5e5e5; }
      .subtitle { color: #666; font-size: 14px; margin-bottom: 32px; }
      .member { display: flex; align-items: center; gap: 12px; padding: 8px 0; border-bottom: 1px solid #f0f0f0; }
      .avatar { width: 36px; height: 36px; border-radius: 50%; background: #e5e5e5; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 600; color: #666; overflow: hidden; }
      .avatar img { width: 100%; height: 100%; object-fit: cover; }
      .info { flex: 1; }
      .name { font-weight: 500; }
      .contact { font-size: 12px; color: #888; }
      @media print { body { padding: 20px; } }
    </style></head><body>`;
    html += `<h1>My Network - Selected Members</h1>`;
    html += `<p class="subtitle">${selected.length} members selected &middot; ${new Date().toLocaleDateString()}</p>`;

    grouped.forEach((members, treeName) => {
      html += `<h2>${treeName}</h2>`;
      members.forEach(m => {
        const initials = `${m.firstName?.[0] || ""}${m.lastName?.[0] || ""}`.toUpperCase();
        html += `<div class="member">`;
        html += `<div class="avatar">${m.photoUrl ? `<img src="${m.photoUrl}" />` : initials}</div>`;
        html += `<div class="info"><div class="name">${m.firstName}${m.lastName ? " " + m.lastName : ""}</div>`;
        const contacts: string[] = [];
        if (m.email) contacts.push(m.email);
        if (m.phone) contacts.push(m.phone);
        if (contacts.length > 0) html += `<div class="contact">${contacts.join(" &middot; ")}</div>`;
        html += `</div></div>`;
      });
    });

    html += `</body></html>`;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  }, [allMembers, selectedMemberIds, toast]);

  const handleCopySelected = useCallback(() => {
    const selected = allMembers.filter(m => selectedMemberIds.has(m.uniqueKey));
    if (selected.length === 0) {
      toast({ title: "No members selected", description: "Select members first to copy.", variant: "destructive" });
      return;
    }

    const lines = selected.map(m => {
      let line = `${m.firstName}${m.lastName ? " " + m.lastName : ""} (${m.treeName})`;
      const contacts: string[] = [];
      if (m.email) contacts.push(m.email);
      if (m.phone) contacts.push(m.phone);
      if (contacts.length > 0) line += ` - ${contacts.join(", ")}`;
      return line;
    });

    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      toast({ title: "Copied", description: `${selected.length} member(s) copied to clipboard.` });
    }).catch(() => {
      toast({ title: "Copy failed", description: "Could not copy to clipboard.", variant: "destructive" });
    });
  }, [allMembers, selectedMemberIds, toast]);

  const getExportRef = () => {
    if (activeTab === "hub") return hubRef;
    if (activeTab === "expanded") return expandedRef;
    if (activeTab === "all-members") return allMembersRef;
    return sharedRef;
  };

  const handleExport = async () => {
    const ref = getExportRef();
    if (!ref.current) return;

    setIsExporting(true);
    try {
      const dataUrl = await toPng(ref.current, {
        backgroundColor: "#ffffff",
        quality: 1.0,
        pixelRatio: 2,
        cacheBust: true,
        skipAutoScale: true,
        fetchRequestInit: { mode: "cors" } as any,
        filter: (node: HTMLElement) => {
          if (node.tagName === "IMG") {
            (node as HTMLImageElement).crossOrigin = "anonymous";
          }
          return true;
        },
      });

      const link = document.createElement("a");
      link.download = `network-overview-${activeTab}-${new Date().toISOString().split("T")[0]}.png`;
      link.href = dataUrl;
      link.click();

      toast({
        title: "Exported",
        description: "Image saved successfully.",
      });
    } catch {
      toast({
        title: "Export Failed",
        description: "Could not export the image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const filteredSharedConnections = useMemo(() => {
    if (!sharedConnections) return [];
    return sharedConnections
      .map(conn => ({
        ...conn,
        appearances: conn.appearances.filter(app => activeVisibleIds.has(app.treeId)),
      }))
      .filter(conn => conn.appearances.length >= 2);
  }, [sharedConnections, activeVisibleIds]);

  const selectedTree = trees?.find((t) => t.id === selectedTreeId);
  const selectedTreeConfig = selectedTree?.treeType
    ? getTreeTypeConfig(selectedTree.treeType as TreeType)
    : null;

  return (
    <div className="min-h-screen bg-background" data-testid="network-overview-page">
      <div className="container mx-auto px-4 py-6 max-w-5xl">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon" data-testid="button-back-dashboard">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-serif font-semibold">My Network Overview</h1>
            <p className="text-sm text-muted-foreground">
              See all your trees, members, and shared connections in one place.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={isExporting}
            data-testid="export-button"
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Export as Image
          </Button>
          <Link href="/merchandise">
            <Button variant="outline" data-testid="merch-button">
              <ShoppingBag className="h-4 w-4 mr-2" />
              Use on Merchandise
            </Button>
          </Link>
        </div>

        {trees && trees.length > 1 && (
          <div className="mb-4" data-testid="tree-filter-bar">
            <div className="flex items-center gap-2 mb-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Focus on:</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={showAll}
                className={isAllVisible ? "text-primary" : "text-muted-foreground"}
                data-testid="button-show-all-trees"
              >
                All
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {trees.map(tree => {
                const config = getTreeTypeConfig((tree.treeType || "custom") as TreeType);
                const isVisible = activeVisibleIds.has(tree.id);
                return (
                  <Badge
                    key={tree.id}
                    variant="outline"
                    className={`cursor-pointer transition-opacity toggle-elevate ${isVisible ? "toggle-elevated" : ""}`}
                    style={{
                      borderColor: config.visual.accentColor,
                      color: isVisible ? config.visual.accentColor : undefined,
                      opacity: isVisible ? 1 : 0.4,
                    }}
                    onClick={() => toggleTreeVisibility(tree.id)}
                    data-testid={`filter-tree-${tree.id}`}
                  >
                    {tree.name}
                  </Badge>
                );
              })}
            </div>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="hub" data-testid="tab-hub">
              <Share2 className="h-4 w-4 mr-1" />
              My Network
            </TabsTrigger>
            <TabsTrigger value="expanded" data-testid="tab-expanded">
              <Eye className="h-4 w-4 mr-1" />
              Expanded View
            </TabsTrigger>
            <TabsTrigger value="all-members" data-testid="tab-all-members">
              <List className="h-4 w-4 mr-1" />
              All Members
            </TabsTrigger>
            <TabsTrigger value="shared" data-testid="tab-shared">
              <Users className="h-4 w-4 mr-1" />
              Shared Connections
            </TabsTrigger>
          </TabsList>

          <TabsContent value="hub">
            <div ref={hubRef} data-testid="hub-visualization" className="bg-background rounded-lg p-4">
              {treesLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : !filteredTrees || filteredTrees.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                  <Users className="h-12 w-12 mb-4" />
                  <p className="text-lg font-medium">{trees && trees.length > 0 ? "No trees selected" : "No trees yet"}</p>
                  <p className="text-sm">{trees && trees.length > 0 ? "Use the filter above to choose which trees to display." : "Create a tree from the dashboard to see your network."}</p>
                </div>
              ) : (
                <HubVisualization trees={filteredTrees} />
              )}
            </div>
          </TabsContent>

          <TabsContent value="expanded">
            <div ref={expandedRef} data-testid="expanded-tree-grid" className="bg-background rounded-lg p-4">
              <div className="mb-4">
                <Select value={selectedTreeId} onValueChange={setSelectedTreeId}>
                  <SelectTrigger className="w-full max-w-xs" data-testid="select-tree">
                    <SelectValue placeholder="Select a tree to view" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredTrees.map((tree) => (
                      <SelectItem key={tree.id} value={tree.id}>
                        {tree.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {!selectedTreeId ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Eye className="h-10 w-10 mb-3" />
                  <p>Select a tree above to see its members.</p>
                </div>
              ) : treeDetailLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : treeDetail ? (
                <div>
                  <div className="flex items-center gap-2 mb-4 flex-wrap">
                    <h2 className="text-lg font-semibold">{treeDetail.tree.name}</h2>
                    {selectedTreeConfig && (
                      <Badge
                        variant="secondary"
                        style={{
                          backgroundColor: selectedTreeConfig.visual.accentColorLight,
                          color: selectedTreeConfig.visual.accentColor,
                        }}
                      >
                        {selectedTreeConfig.label}
                      </Badge>
                    )}
                  </div>
                  {treeDetail.members.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No members in this tree yet.</p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {treeDetail.members.map((member) => {
                        const initials = `${member.firstName?.[0] || ""}${member.lastName?.[0] || ""}`.toUpperCase();
                        return (
                          <Card
                            key={member.id}
                            data-testid={`member-card-${member.id}`}
                            style={{
                              borderColor: selectedTreeConfig?.visual.accentColor,
                              borderWidth: "1px",
                            }}
                          >
                            <CardContent className="flex flex-col items-center p-4 gap-2">
                              <Avatar className="h-12 w-12">
                                {member.photoUrl && (
                                  <AvatarImage src={member.photoUrl} alt={member.firstName} />
                                )}
                                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                              </Avatar>
                              <div className="text-center">
                                <p className="text-sm font-medium leading-tight">{member.firstName}</p>
                                {member.lastName && (
                                  <p className="text-xs text-muted-foreground">{member.lastName}</p>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </TabsContent>

          <TabsContent value="all-members">
            <div ref={allMembersRef} data-testid="all-members-grid" className="bg-background rounded-lg p-4">
              {selectedMemberIds.size > 0 && (
                <div className="flex items-center gap-2 mb-4 p-3 rounded-lg border bg-card flex-wrap" data-testid="selection-action-bar">
                  <Check className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">{selectedMemberIds.size} selected</span>
                  <div className="flex-1" />
                  <Button size="sm" variant="outline" onClick={handlePrintSelected} data-testid="button-print-selected">
                    <Printer className="h-4 w-4 mr-1" />
                    Print
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleCopySelected} data-testid="button-copy-selected">
                    <Copy className="h-4 w-4 mr-1" />
                    Copy
                  </Button>
                  <Button size="sm" variant="ghost" onClick={clearSelection} data-testid="button-clear-selection">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}

              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search members by name or tree..."
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    className="pl-9"
                    data-testid="input-member-search"
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={selectAllVisible}
                  data-testid="button-select-all"
                >
                  Select All ({filteredMembers.length})
                </Button>
              </div>

              {allTreesLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredMembers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Users className="h-10 w-10 mb-3" />
                  <p className="text-lg font-medium">
                    {allMembers.length === 0 ? "No members found" : "No matching members"}
                  </p>
                  <p className="text-sm">
                    {allMembers.length === 0
                      ? "Members from your trees will appear here."
                      : "Try a different search term."}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredMembers.map((member) => {
                    const config = getTreeTypeConfig(member.treeType as TreeType);
                    const initials = `${member.firstName?.[0] || ""}${member.lastName?.[0] || ""}`.toUpperCase();
                    const isSelected = selectedMemberIds.has(member.uniqueKey);
                    return (
                      <div
                        key={member.uniqueKey}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover-elevate ${isSelected ? "border-primary bg-primary/5" : ""}`}
                        onClick={() => toggleMemberSelection(member.uniqueKey)}
                        data-testid={`member-row-${member.uniqueKey}`}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleMemberSelection(member.uniqueKey)}
                          onClick={(e) => e.stopPropagation()}
                          data-testid={`checkbox-member-${member.uniqueKey}`}
                        />
                        <Avatar className="h-10 w-10 shrink-0">
                          {member.photoUrl && (
                            <AvatarImage src={member.photoUrl} alt={member.firstName} />
                          )}
                          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">
                            {member.firstName}{member.lastName ? ` ${member.lastName}` : ""}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {config.memberLabel || "Member"}
                            {(member.email || member.phone) ? ` \u00B7 ${[member.email, member.phone].filter(Boolean).join(" \u00B7 ")}` : ""}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          style={{
                            borderColor: config.visual.accentColor,
                            color: config.visual.accentColor,
                          }}
                        >
                          {member.treeName}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="shared">
            <div ref={sharedRef} data-testid="shared-connections-list" className="bg-background rounded-lg p-4">
              {sharedLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredSharedConnections.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Share2 className="h-10 w-10 mb-3" />
                  <p className="text-lg font-medium">No shared connections found</p>
                  <p className="text-sm text-center max-w-md mt-1">
                    {sharedConnections && sharedConnections.length > 0
                      ? "Try selecting more trees in the filter above to see cross-tree matches."
                      : "Shared connections appear when the same person shows up in multiple trees. Add more members to your trees to discover connections."}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredSharedConnections.map((connection, idx) => {
                    const initials = connection.name
                      .split(" ")
                      .map((w) => w[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2);
                    return (
                      <Card key={idx} data-testid={`shared-connection-${idx}`}>
                        <CardContent className="flex items-start gap-4 p-4">
                          <Avatar className="h-10 w-10 shrink-0">
                            {connection.photoUrl && (
                              <AvatarImage src={connection.photoUrl} alt={connection.name} />
                            )}
                            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium">{connection.name}</p>
                              <Badge variant={getMatchBadgeVariant(connection.matchType)}>
                                {getMatchLabel(connection.matchType)}
                              </Badge>
                            </div>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {connection.appearances.map((app) => {
                                const config = getTreeTypeConfig((app.treeType || "custom") as TreeType);
                                return (
                                  <Badge
                                    key={`${app.treeId}-${app.memberId}`}
                                    variant="outline"
                                    style={{
                                      borderColor: config.visual.accentColor,
                                      color: config.visual.accentColor,
                                    }}
                                  >
                                    {app.treeName}
                                  </Badge>
                                );
                              })}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function HubVisualization({ trees }: { trees: TreeItem[] }) {
  const [, navigate] = useLocation();
  const cx = 400;
  const cy = 400;
  const radius = 280;

  return (
    <svg
      viewBox="0 0 800 800"
      className="w-full max-w-2xl mx-auto"
      style={{ aspectRatio: "1 / 1" }}
    >
      {trees.map((tree, i) => {
        const angle = (2 * Math.PI * i) / trees.length - Math.PI / 2;
        const tx = cx + radius * Math.cos(angle);
        const ty = cy + radius * Math.sin(angle);
        const config = getTreeTypeConfig((tree.treeType || "custom") as TreeType);

        return (
          <line
            key={`line-${tree.id}`}
            x1={cx}
            y1={cy}
            x2={tx}
            y2={ty}
            stroke={config.visual.accentColor}
            strokeWidth={2}
          />
        );
      })}

      <circle cx={cx} cy={cy} r={50} fill="hsl(var(--primary))" />
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fill="hsl(var(--primary-foreground))"
        fontSize={18}
        fontWeight="bold"
      >
        You
      </text>

      {trees.map((tree, i) => {
        const angle = (2 * Math.PI * i) / trees.length - Math.PI / 2;
        const tx = cx + radius * Math.cos(angle);
        const ty = cy + radius * Math.sin(angle);
        const config = getTreeTypeConfig((tree.treeType || "custom") as TreeType);
        const truncatedName =
          tree.name.length > 12 ? tree.name.slice(0, 11) + "..." : tree.name;

        return (
          <g
            key={`node-${tree.id}`}
            onClick={() => navigate(`/tree/${tree.id}`)}
            style={{ cursor: "pointer" }}
            data-testid={`hub-tree-node-${tree.id}`}
          >
            <circle
              cx={tx}
              cy={ty}
              r={35}
              fill={config.visual.accentColorLight}
              stroke={config.visual.accentColor}
              strokeWidth={2}
            />
            <text
              x={tx}
              y={ty - 6}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={10}
              fontWeight="600"
              fill={config.visual.accentColor}
            >
              {truncatedName}
            </text>
            <text
              x={tx}
              y={ty + 10}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={9}
              fill={config.visual.accentColor}
            >
              {tree.memberCount ?? 0}
            </text>
            <text
              x={tx}
              y={ty + 50}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={10}
              fill={config.visual.accentColor}
              opacity={0.8}
            >
              {config.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
