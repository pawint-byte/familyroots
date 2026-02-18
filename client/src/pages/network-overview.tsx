import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { toPng } from "html-to-image";
import { Download, ShoppingBag, Users, Eye, Share2, Loader2 } from "lucide-react";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
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

  const hubRef = useRef<HTMLDivElement>(null);
  const expandedRef = useRef<HTMLDivElement>(null);
  const sharedRef = useRef<HTMLDivElement>(null);

  const { data: trees, isLoading: treesLoading } = useQuery<TreeItem[]>({
    queryKey: ["/api/trees"],
  });

  const { data: treeDetail, isLoading: treeDetailLoading } = useQuery<TreeDetailData>({
    queryKey: ["/api/trees", selectedTreeId],
    enabled: !!selectedTreeId,
  });

  const { data: sharedConnections, isLoading: sharedLoading } = useQuery<SharedConnection[]>({
    queryKey: ["/api/network/shared"],
  });

  const getExportRef = () => {
    if (activeTab === "hub") return hubRef;
    if (activeTab === "expanded") return expandedRef;
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
              ) : !trees || trees.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                  <Users className="h-12 w-12 mb-4" />
                  <p className="text-lg font-medium">No trees yet</p>
                  <p className="text-sm">Create a tree from the dashboard to see your network.</p>
                </div>
              ) : (
                <HubVisualization trees={trees} />
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
                    {trees?.map((tree) => (
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

          <TabsContent value="shared">
            <div ref={sharedRef} data-testid="shared-connections-list" className="bg-background rounded-lg p-4">
              {sharedLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : !sharedConnections || sharedConnections.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Share2 className="h-10 w-10 mb-3" />
                  <p className="text-lg font-medium">No shared connections found</p>
                  <p className="text-sm text-center max-w-md mt-1">
                    Shared connections appear when the same person shows up in multiple trees.
                    Add more members to your trees to discover connections.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sharedConnections.map((connection, idx) => {
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
                                const config = getTreeTypeConfig(app.treeType as TreeType);
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
          <g key={`node-${tree.id}`}>
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
