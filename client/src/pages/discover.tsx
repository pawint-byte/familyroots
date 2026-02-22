import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { SEO } from "@/components/seo";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Search, Users, Church, Trophy, GraduationCap, Heart, Briefcase,
  Sparkles, MapPin, ArrowRight, UserPlus, LogIn, Globe, Filter,
  ArrowLeft, Shield, GitBranch
} from "lucide-react";
import { TREE_TYPE_CONFIGS, type TreeType } from "@shared/treeTypes";
import type { FamilyTree } from "@shared/schema";

type DiscoverableTree = FamilyTree & { memberCount: number; ownerName: string; childCount?: number };

const DISCOVERY_CATEGORIES = [
  { value: "alumni", label: "Alumni / School", icon: GraduationCap },
  { value: "church", label: "Church / Faith", icon: Church },
  { value: "sports", label: "Sports / Athletics", icon: Trophy },
  { value: "greek", label: "Fraternity / Sorority", icon: GraduationCap },
  { value: "community", label: "Community Group", icon: Users },
  { value: "professional", label: "Professional Network", icon: Briefcase },
  { value: "social", label: "Friend Circle", icon: Heart },
  { value: "other", label: "Other", icon: Sparkles },
];

function getTreeTypeIcon(treeType: string) {
  switch (treeType) {
    case "family": return Users;
    case "church": return Church;
    case "sports": return Trophy;
    case "fraternity": return GraduationCap;
    case "friends": return Heart;
    case "professional": return Briefcase;
    case "custom": return Sparkles;
    default: return Users;
  }
}

export default function Discover() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedTreeType, setSelectedTreeType] = useState<string>("");
  const [joinConfirmTree, setJoinConfirmTree] = useState<DiscoverableTree | null>(null);

  const queryParams = new URLSearchParams();
  if (searchQuery) queryParams.set("search", searchQuery);
  if (selectedCategory) queryParams.set("category", selectedCategory);
  if (selectedTreeType) queryParams.set("treeType", selectedTreeType);

  const { data: trees, isLoading } = useQuery<DiscoverableTree[]>({
    queryKey: ["/api/discover", searchQuery, selectedCategory, selectedTreeType],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      if (selectedCategory) params.set("category", selectedCategory);
      if (selectedTreeType) params.set("treeType", selectedTreeType);
      const res = await fetch(`/api/discover?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const joinMutation = useMutation({
    mutationFn: async (treeId: string) => {
      const res = await apiRequest("POST", `/api/discover/${treeId}/join`);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Joined!", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/discover"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trees"] });
    },
    onError: (error: any) => {
      toast({ title: "Could not join", description: error.message, variant: "destructive" });
    },
  });

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedCategory("");
    setSelectedTreeType("");
  };

  const hasFilters = searchQuery || selectedCategory || selectedTreeType;

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Discover Communities - FamilyRoots"
        description="Find and join public communities, alumni groups, churches, sports teams, and more on FamilyRoots."
      />

      <div className="border-b bg-card/50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(user ? "/dashboard" : "/")} data-testid="button-back-home">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Globe className="h-6 w-6 text-primary" />
                Discover Communities
              </h1>
              <p className="text-sm text-muted-foreground">Find and join open groups, alumni networks, churches, and more</p>
            </div>
          </div>
          {!user && (
            <Button onClick={() => navigate("/")} className="gap-2" data-testid="button-login-to-join">
              <LogIn className="h-4 w-4" />
              Sign in to Join
            </Button>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, description, or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-discover-search"
            />
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-full sm:w-[200px]" data-testid="select-category">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {DISCOVERY_CATEGORIES.map(cat => (
                <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedTreeType} onValueChange={setSelectedTreeType}>
            <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-tree-type">
              <SelectValue placeholder="Tree Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {Object.entries(TREE_TYPE_CONFIGS).map(([key, config]) => (
                <SelectItem key={key} value={key}>{config.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="button-clear-filters">
              Clear
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Card key={i}>
                <CardContent className="p-6 space-y-3">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-10 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : trees && trees.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {trees.map(tree => {
              const config = TREE_TYPE_CONFIGS[tree.treeType as TreeType];
              const TypeIcon = getTreeTypeIcon(tree.treeType);
              const category = DISCOVERY_CATEGORIES.find(c => c.value === tree.discoveryCategory);

              return (
                <Card key={tree.id} className="hover:shadow-md transition-shadow" data-testid={`card-discover-${tree.id}`}>
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 rounded-lg" style={{ backgroundColor: config?.visual?.accentColor || '#6366f1' }}>
                          <AvatarFallback className="rounded-lg bg-transparent text-white">
                            <TypeIcon className="h-5 w-5" />
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="font-semibold text-base line-clamp-1" data-testid={`text-tree-name-${tree.id}`}>{tree.name}</h3>
                          <p className="text-xs text-muted-foreground">{config?.label || tree.treeType}</p>
                        </div>
                      </div>
                      {tree.autoJoin && (
                        <Badge variant="secondary" className="text-xs shrink-0" data-testid={`badge-auto-join-${tree.id}`}>
                          Auto-Join
                        </Badge>
                      )}
                    </div>

                    {tree.discoveryDescription && (
                      <p className="text-sm text-muted-foreground line-clamp-2" data-testid={`text-description-${tree.id}`}>
                        {tree.discoveryDescription}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-2">
                      {category && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <category.icon className="h-3 w-3" />
                          {category.label}
                        </Badge>
                      )}
                      {tree.discoveryLocation && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <MapPin className="h-3 w-3" />
                          {tree.discoveryLocation}
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1" data-testid={`text-member-count-${tree.id}`}>
                          <Users className="h-3.5 w-3.5" />
                          {tree.memberCount} {tree.memberCount === 1 ? "member" : "members"}
                        </span>
                        {(tree.childCount ?? 0) > 0 && (
                          <span className="flex items-center gap-1" data-testid={`text-subgroup-count-${tree.id}`}>
                            <GitBranch className="h-3.5 w-3.5" />
                            {tree.childCount} {tree.childCount === 1 ? "sub-group" : "sub-groups"}
                          </span>
                        )}
                        <span className="text-muted-foreground/60">by {tree.ownerName}</span>
                      </div>
                      {user ? (
                        <Button
                          size="sm"
                          onClick={() => setJoinConfirmTree(tree)}
                          disabled={joinMutation.isPending}
                          className="gap-1"
                          data-testid={`button-join-${tree.id}`}
                        >
                          <UserPlus className="h-3.5 w-3.5" />
                          Join
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate("/")}
                          className="gap-1"
                          data-testid={`button-sign-in-${tree.id}`}
                        >
                          <LogIn className="h-3.5 w-3.5" />
                          Sign in
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16 space-y-4">
            <Globe className="h-16 w-16 mx-auto text-muted-foreground/30" />
            <div>
              <h3 className="text-lg font-semibold" data-testid="text-no-communities">
                {hasFilters ? "No communities match your search" : "No communities to discover yet"}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {hasFilters
                  ? "Try adjusting your filters or search terms"
                  : "Be the first to make your community discoverable! Go to your tree settings and turn on discoverability."
                }
              </p>
            </div>
            {hasFilters && (
              <Button variant="outline" onClick={clearFilters} data-testid="button-clear-filters-empty">
                Clear Filters
              </Button>
            )}
          </div>
        )}
      </div>

      <AlertDialog open={!!joinConfirmTree} onOpenChange={(open) => !open && setJoinConfirmTree(null)}>
        <AlertDialogContent data-testid="dialog-join-privacy">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Join {joinConfirmTree?.name}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  This is a public community. By joining, your <strong>name and photo</strong> will be visible to anyone who views this group.
                </p>
                <p>
                  Other personal details (email, birth date, location, etc.) remain <strong>private</strong> and are only visible to the group owner and collaborators.
                </p>
                <p className="text-xs text-muted-foreground">
                  You can leave this community at any time from your tree settings.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-join">Cancel</AlertDialogCancel>
            <AlertDialogAction
              data-testid="button-confirm-join"
              onClick={() => {
                if (joinConfirmTree) {
                  joinMutation.mutate(joinConfirmTree.id);
                  setJoinConfirmTree(null);
                }
              }}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Join Community
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
