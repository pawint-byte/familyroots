import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SEO } from "@/components/seo";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  ArrowLeft, Search, BookOpen, Link2, ExternalLink, 
  User, Calendar, MapPin, FileText, CheckCircle, AlertCircle,
  Download, TreePine, Loader2, Users, ChevronDown, ChevronRight, Info
} from "lucide-react";

interface SearchResult {
  id: string;
  score: number;
  person: {
    id: string;
    display?: {
      name?: string;
      gender?: string;
      birthDate?: string;
      birthPlace?: string;
      deathDate?: string;
      deathPlace?: string;
    };
  };
  recordDescriptor?: {
    id: string;
    title: string;
  };
  relatedPersons?: Array<{
    id: string;
    display: { name?: string; gender?: string };
  }>;
  relationships?: Array<{
    type: string;
    person1Id: string;
    person2Id: string;
  }>;
}

interface FamilySearchStatus {
  configured: boolean;
  connected: boolean;
  displayName: string | null;
  connectedAt: string | null;
}

interface FamilyTree {
  id: string;
  name: string;
  treeType?: string;
}

interface FamilySearchPerson {
  id: string;
  name: string;
  gender?: string;
  birthDate?: string;
  birthPlace?: string;
  deathDate?: string;
  deathPlace?: string;
  living?: boolean;
}

interface FamilySearchRelationship {
  type: "parent-child" | "couple";
  person1Id: string;
  person2Id: string;
}

interface TreeData {
  persons: FamilySearchPerson[];
  relationships: FamilySearchRelationship[];
  rootPersonId: string;
  isMock: boolean;
}

export default function RecordsPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const urlParams = new URLSearchParams(window.location.search);
  const pathBasedTab = window.location.pathname.includes("/familysearch/import") ? "import" : null;
  const initialTab = urlParams.get("tab") || pathBasedTab || "search";
  const preselectedTreeId = urlParams.get("treeId") || undefined;
  
  const [activeTab, setActiveTab] = useState(initialTab);
  const [searchParams, setSearchParams] = useState({
    givenName: "",
    surname: "",
    birthYear: "",
    birthPlace: "",
    deathYear: "",
    deathPlace: "",
  });
  const [activeSearch, setActiveSearch] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const [selectedTreeId, setSelectedTreeId] = useState<string>(preselectedTreeId || "");
  const [familyMembers, setFamilyMembers] = useState<FamilySearchPerson[]>([]);
  const [familyRelationships, setFamilyRelationships] = useState<FamilySearchRelationship[]>([]);
  const [selectedFamilyIds, setSelectedFamilyIds] = useState<Set<string>>(new Set());
  const [loadingFamily, setLoadingFamily] = useState(false);

  const [selectedPersons, setSelectedPersons] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(["ancestors", "descendants", "self"]));

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    const connected = params.get("connected");
    
    if (error) {
      const errorMessages: Record<string, string> = {
        invalid_state: "The connection request expired or was invalid. Please try connecting again.",
        token_exchange_failed: "FamilySearch rejected the connection. This may happen if the redirect URL hasn't been approved yet. Please try again later.",
        callback_failed: "Something went wrong while connecting to FamilySearch. Please try again.",
      };
      toast({
        title: "Connection Failed",
        description: errorMessages[error] || "Could not connect to FamilySearch. Please try again.",
        variant: "destructive",
      });
      window.history.replaceState({}, "", "/familysearch");
    } else if (connected === "true") {
      queryClient.invalidateQueries({ queryKey: ["/api/familysearch/status"] });
      toast({
        title: "Connected!",
        description: "Your FamilySearch account has been connected. You can now search and import.",
      });
      window.history.replaceState({}, "", "/familysearch");
    }
  }, [toast]);

  const { data: status, isLoading: statusLoading } = useQuery<FamilySearchStatus>({
    queryKey: ["/api/familysearch/status"],
    enabled: !!user,
  });

  const searchQueryString = activeSearch ? new URLSearchParams(
    Object.entries(searchParams).filter(([_, v]) => v !== "")
  ).toString() : "";

  const { data: results = [], isLoading: searchLoading } = useQuery<SearchResult[]>({
    queryKey: ["/api/familysearch/search", searchParams],
    queryFn: async () => {
      const res = await fetch(`/api/familysearch/search?${searchQueryString}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${res.status}: ${text}`);
      }
      return res.json();
    },
    enabled: activeSearch && !!(searchParams.givenName || searchParams.surname),
  });

  const { data: trees = [] } = useQuery<FamilyTree[]>({
    queryKey: ["/api/trees"],
    enabled: !!user,
  });

  const { data: treeData, isLoading: treeLoading, error: treeError } = useQuery<TreeData>({
    queryKey: ["/api/familysearch/tree"],
    enabled: !!user && activeTab === "import" && (status?.connected || !status?.configured),
    retry: (failureCount, error: any) => {
      if (error?.message?.includes("401") || error?.tokenExpired) return false;
      return failureCount < 2;
    },
  });

  useEffect(() => {
    if (treeError) {
      const errorMsg = (treeError as any)?.message || "";
      if (errorMsg.includes("401") || errorMsg.includes("expired")) {
        queryClient.invalidateQueries({ queryKey: ["/api/familysearch/status"] });
        toast({
          title: "Session Expired",
          description: "Your FamilySearch session has expired. Please reconnect your account.",
          variant: "destructive",
        });
      }
    }
  }, [treeError]);

  const connectMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("GET", "/api/familysearch/auth");
      const data = await response.json();
      return data.authUrl;
    },
    onSuccess: (authUrl) => {
      window.location.href = authUrl;
    },
    onError: () => {
      toast({
        title: "Connection Failed",
        description: "Could not connect to FamilySearch. Please try again.",
        variant: "destructive",
      });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", "/api/familysearch/connection");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/familysearch/status"] });
      toast({
        title: "Disconnected",
        description: "Your FamilySearch account has been disconnected.",
      });
    },
  });

  const searchImportMutation = useMutation({
    mutationFn: async (data: { treeId: string; persons: any[]; relationships: any[] }) => {
      const response = await apiRequest("POST", "/api/familysearch/import", data);
      return response.json();
    },
    onSuccess: (result) => {
      toast({
        title: "Import Successful",
        description: `Added ${result.imported.members} person${result.imported.members !== 1 ? 's' : ''} to your tree.${result.skipped.duplicates > 0 ? ` Skipped ${result.skipped.duplicates} duplicate${result.skipped.duplicates !== 1 ? 's' : ''}.` : ""}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/trees"] });
      setImportDialogOpen(false);
      setSelectedResult(null);
      setSelectedTreeId(preselectedTreeId || "");
    },
    onError: () => {
      toast({
        title: "Import Failed",
        description: "Could not import this person. Please try again.",
        variant: "destructive",
      });
    },
  });

  const treeImportMutation = useMutation({
    mutationFn: async (data: { treeId: string; persons: FamilySearchPerson[]; relationships: FamilySearchRelationship[] }) => {
      const response = await apiRequest("POST", "/api/familysearch/import", data);
      return response.json();
    },
    onSuccess: (result) => {
      toast({
        title: "Import Successful",
        description: `Imported ${result.imported.members} people and ${result.imported.relationships} relationships.${result.skipped.duplicates > 0 ? ` Skipped ${result.skipped.duplicates} duplicates.` : ""}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/trees"] });
      const targetTreeId = preselectedTreeId || trees[0]?.id;
      if (targetTreeId) {
        navigate(`/tree/${targetTreeId}`);
      }
    },
    onError: () => {
      toast({
        title: "Import Failed",
        description: "Could not import the selected people. Please try again.",
        variant: "destructive",
      });
    },
  });

  const organizedPersons = useMemo(() => {
    if (!treeData) return { self: [], ancestors: [], descendants: [], spouses: [] };
    
    const { persons, relationships, rootPersonId } = treeData;
    const parentChildRels = relationships.filter(r => r.type === "parent-child");
    const coupleRels = relationships.filter(r => r.type === "couple");
    
    const childToParents = new Map<string, string[]>();
    const parentToChildren = new Map<string, string[]>();
    
    for (const rel of parentChildRels) {
      const parents = childToParents.get(rel.person2Id) || [];
      parents.push(rel.person1Id);
      childToParents.set(rel.person2Id, parents);
      
      const children = parentToChildren.get(rel.person1Id) || [];
      children.push(rel.person2Id);
      parentToChildren.set(rel.person1Id, children);
    }
    
    const spouseIds = new Set<string>();
    for (const rel of coupleRels) {
      if (rel.person1Id === rootPersonId) spouseIds.add(rel.person2Id);
      if (rel.person2Id === rootPersonId) spouseIds.add(rel.person1Id);
    }
    
    const ancestorIds = new Set<string>();
    const queue = [...(childToParents.get(rootPersonId) || [])];
    while (queue.length > 0) {
      const id = queue.shift()!;
      if (!ancestorIds.has(id)) {
        ancestorIds.add(id);
        const parents = childToParents.get(id) || [];
        queue.push(...parents);
      }
    }
    
    const descendantIds = new Set<string>();
    const descQueue = [...(parentToChildren.get(rootPersonId) || [])];
    while (descQueue.length > 0) {
      const id = descQueue.shift()!;
      if (!descendantIds.has(id)) {
        descendantIds.add(id);
        const children = parentToChildren.get(id) || [];
        descQueue.push(...children);
      }
    }
    
    const self = persons.filter(p => p.id === rootPersonId);
    const ancestors = persons.filter(p => ancestorIds.has(p.id));
    const descendants = persons.filter(p => descendantIds.has(p.id));
    const spouses = persons.filter(p => spouseIds.has(p.id));
    
    return { self, ancestors, descendants, spouses };
  }, [treeData]);

  const handleSearch = () => {
    if (searchParams.givenName || searchParams.surname) {
      setActiveSearch(true);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setSearchParams(prev => ({ ...prev, [field]: value }));
    setActiveSearch(false);
  };

  const handleImportClick = async (result: SearchResult) => {
    setSelectedResult(result);
    if (trees.length === 1) {
      setSelectedTreeId(trees[0].id);
    }
    setFamilyMembers([]);
    setFamilyRelationships([]);
    setSelectedFamilyIds(new Set([result.person.id]));
    setImportDialogOpen(true);
    
    if (status?.connected && result.person.id) {
      setLoadingFamily(true);
      try {
        const response = await apiRequest("GET", `/api/familysearch/person/${result.person.id}/family`);
        const data = await response.json();
        if (data.persons && data.persons.length > 0) {
          setFamilyMembers(data.persons);
          setFamilyRelationships(data.relationships || []);
          setSelectedFamilyIds(new Set(data.persons.map((p: FamilySearchPerson) => p.id)));
        }
      } catch (err) {
        console.log("Could not fetch family data:", err);
      } finally {
        setLoadingFamily(false);
      }
    }
  };

  const handleConfirmImport = () => {
    if (!selectedResult || !selectedTreeId) return;

    if (familyMembers.length > 0) {
      const personsToImport = familyMembers.filter(p => selectedFamilyIds.has(p.id));
      const selectedIdSet = selectedFamilyIds;
      const relsToImport = familyRelationships.filter(r => 
        selectedIdSet.has(r.person1Id) && selectedIdSet.has(r.person2Id)
      );
      
      searchImportMutation.mutate({
        treeId: selectedTreeId,
        persons: personsToImport,
        relationships: relsToImport,
      });
    } else {
      const display = selectedResult.person.display;
      const person = {
        id: selectedResult.person.id || selectedResult.id,
        name: display?.name || "Unknown",
        gender: display?.gender?.toLowerCase(),
        birthDate: display?.birthDate,
        birthPlace: display?.birthPlace,
        deathDate: display?.deathDate,
        living: !display?.deathDate,
      };

      searchImportMutation.mutate({
        treeId: selectedTreeId,
        persons: [person],
        relationships: [],
      });
    }
  };

  const toggleGroup = (group: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  };

  const togglePerson = (id: string) => {
    setSelectedPersons(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (treeData) setSelectedPersons(new Set(treeData.persons.map(p => p.id)));
  };

  const selectNone = () => setSelectedPersons(new Set());

  const handleTreeImport = () => {
    const targetTreeId = preselectedTreeId || selectedTreeId || trees[0]?.id;
    if (!targetTreeId) {
      toast({ title: "No Tree Selected", description: "Please create a tree first before importing.", variant: "destructive" });
      return;
    }
    if (selectedPersons.size === 0) {
      toast({ title: "No People Selected", description: "Please select at least one person to import.", variant: "destructive" });
      return;
    }
    
    const personsToImport = treeData!.persons.filter(p => selectedPersons.has(p.id));
    const relationshipsToImport = treeData!.relationships.filter(
      r => selectedPersons.has(r.person1Id) && selectedPersons.has(r.person2Id)
    );
    
    treeImportMutation.mutate({
      treeId: targetTreeId,
      persons: personsToImport,
      relationships: relationshipsToImport,
    });
  };

  const renderPersonCard = (person: FamilySearchPerson) => (
    <div 
      key={person.id}
      className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover-elevate cursor-pointer"
      onClick={() => togglePerson(person.id)}
      data-testid={`person-card-${person.id}`}
    >
      <Checkbox 
        checked={selectedPersons.has(person.id)}
        onCheckedChange={() => togglePerson(person.id)}
        data-testid={`checkbox-person-${person.id}`}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="font-medium truncate">{person.name}</span>
          {person.living && (
            <Badge variant="outline" className="text-xs shrink-0">Living</Badge>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
          {person.birthDate && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              b. {person.birthDate}
            </span>
          )}
          {person.deathDate && (
            <span className="flex items-center gap-1">
              d. {person.deathDate}
            </span>
          )}
          {person.birthPlace && (
            <span className="flex items-center gap-1 truncate">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{person.birthPlace}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );

  const renderPersonGroup = (title: string, persons: FamilySearchPerson[], groupKey: string, icon: React.ReactNode) => {
    if (persons.length === 0) return null;
    const isExpanded = expandedGroups.has(groupKey);
    const selectedCount = persons.filter(p => selectedPersons.has(p.id)).length;
    
    return (
      <div className="border rounded-lg overflow-hidden" data-testid={`group-${groupKey}`}>
        <button
          className="w-full flex items-center gap-3 p-4 bg-muted/30 hover-elevate text-left"
          onClick={() => toggleGroup(groupKey)}
          data-testid={`toggle-group-${groupKey}`}
        >
          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          {icon}
          <span className="font-medium flex-1">{title}</span>
          <Badge variant="secondary">{selectedCount}/{persons.length}</Badge>
        </button>
        {isExpanded && (
          <div className="p-3 space-y-2">
            {persons.map(renderPersonCard)}
          </div>
        )}
      </div>
    );
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <h2 className="text-xl font-semibold mb-2">Sign in Required</h2>
            <p className="text-muted-foreground">Please sign in to use FamilySearch features.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <SEO
        title="FamilySearch - Search & Import | FamilyRoots"
        description="Search billions of historical records and import your family tree from FamilySearch."
      />
      <div className="min-h-screen bg-background">
        <header className="border-b border-border sticky top-0 z-[100] bg-background/95 backdrop-blur">
          <div className="container mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => navigate("/dashboard")} className="gap-2" data-testid="button-back-dashboard">
                <ArrowLeft className="h-4 w-4" />
                Dashboard
              </Button>
              <h1 className="font-serif text-xl font-semibold">FamilySearch</h1>
            </div>
            <ThemeToggle />
          </div>
        </header>

        <main className="container mx-auto px-4 py-8 max-w-4xl">
          <Card className="mb-6" data-testid="card-familysearch-status">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                FamilySearch Connection
              </CardTitle>
              <CardDescription>
                Connect your FamilySearch account to search records and import your family tree.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {statusLoading ? (
                <div className="flex items-center gap-4">
                  <Skeleton className="h-10 w-32" />
                  <Skeleton className="h-4 w-48" />
                </div>
              ) : status?.connected ? (
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="font-medium">Connected as {status.displayName || "FamilySearch User"}</p>
                      <p className="text-sm text-muted-foreground">
                        You can search records and import your tree
                      </p>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    onClick={() => disconnectMutation.mutate()}
                    disabled={disconnectMutation.isPending}
                    data-testid="button-disconnect-familysearch"
                  >
                    Disconnect
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Not Connected</p>
                      <p className="text-sm text-muted-foreground">
                        {status?.configured 
                          ? "Connect your FamilySearch account to search records and import"
                          : "Demo mode - showing sample data. Add FamilySearch credentials to enable."}
                      </p>
                    </div>
                  </div>
                  {status?.configured && (
                    <Button 
                      onClick={() => connectMutation.mutate()}
                      disabled={connectMutation.isPending}
                      data-testid="button-connect-familysearch"
                    >
                      <Link2 className="h-4 w-4 mr-2" />
                      Connect FamilySearch
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-2" data-testid="tabs-familysearch">
              <TabsTrigger value="search" className="gap-2" data-testid="tab-search">
                <Search className="h-4 w-4" />
                Search Records
              </TabsTrigger>
              <TabsTrigger value="import" className="gap-2" data-testid="tab-import">
                <Download className="h-4 w-4" />
                Import Tree
              </TabsTrigger>
            </TabsList>

            <TabsContent value="search" className="space-y-6">
              <Card data-testid="card-record-search">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Search className="h-5 w-5" />
                    Search Historical Records
                  </CardTitle>
                  <CardDescription>
                    Search billions of records by name, dates, and locations. Find a person, then import them directly into your tree.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="givenName">First Name</Label>
                      <Input
                        id="givenName"
                        placeholder="e.g., John"
                        value={searchParams.givenName}
                        onChange={(e) => handleInputChange("givenName", e.target.value)}
                        data-testid="input-given-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="surname">Last Name</Label>
                      <Input
                        id="surname"
                        placeholder="e.g., Smith"
                        value={searchParams.surname}
                        onChange={(e) => handleInputChange("surname", e.target.value)}
                        data-testid="input-surname"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="birthYear">Birth Year</Label>
                      <Input
                        id="birthYear"
                        placeholder="e.g., 1890"
                        value={searchParams.birthYear}
                        onChange={(e) => handleInputChange("birthYear", e.target.value)}
                        data-testid="input-birth-year"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="birthPlace">Birth Place</Label>
                      <Input
                        id="birthPlace"
                        placeholder="e.g., New York, USA"
                        value={searchParams.birthPlace}
                        onChange={(e) => handleInputChange("birthPlace", e.target.value)}
                        data-testid="input-birth-place"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="deathYear">Death Year</Label>
                      <Input
                        id="deathYear"
                        placeholder="e.g., 1965"
                        value={searchParams.deathYear}
                        onChange={(e) => handleInputChange("deathYear", e.target.value)}
                        data-testid="input-death-year"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="deathPlace">Death Place</Label>
                      <Input
                        id="deathPlace"
                        placeholder="e.g., California, USA"
                        value={searchParams.deathPlace}
                        onChange={(e) => handleInputChange("deathPlace", e.target.value)}
                        data-testid="input-death-place"
                      />
                    </div>
                  </div>
                  <Button className="mt-4 gap-2" onClick={handleSearch} data-testid="button-search-records">
                    <Search className="h-4 w-4" />
                    Search Records
                  </Button>
                </CardContent>
              </Card>

              {activeSearch && (
                <Card data-testid="card-search-results">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Search Results
                      {!status?.connected && !status?.configured && (
                        <Badge variant="secondary">Demo Data</Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {searchLoading ? (
                      <div className="space-y-4">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="p-4 border rounded-lg">
                            <Skeleton className="h-5 w-48 mb-2" />
                            <Skeleton className="h-4 w-full mb-1" />
                            <Skeleton className="h-4 w-3/4" />
                          </div>
                        ))}
                      </div>
                    ) : results.length === 0 ? (
                      <div className="text-center py-8">
                        <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-medium mb-2">No Records Found</h3>
                        <p className="text-muted-foreground">
                          Try adjusting your search criteria or adding more details.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {results.map((result) => (
                          <Card key={result.id} className="hover-elevate" data-testid={`record-result-${result.id}`}>
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <User className="h-4 w-4" />
                                    <span className="font-medium" data-testid={`text-record-name-${result.id}`}>
                                      {result.person.display?.name || "Unknown"}
                                    </span>
                                    <Badge variant="outline" className="text-xs">
                                      {Math.round(result.score * 100)}% match
                                    </Badge>
                                  </div>
                                  
                                  {result.recordDescriptor?.title && (
                                    <p className="text-sm font-medium text-muted-foreground mb-2">
                                      {result.recordDescriptor.title}
                                    </p>
                                  )}
                                  
                                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                    {result.person.display?.birthDate && (
                                      <span className="flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />
                                        Born: {result.person.display.birthDate}
                                      </span>
                                    )}
                                    {result.person.display?.birthPlace && (
                                      <span className="flex items-center gap-1">
                                        <MapPin className="h-3 w-3" />
                                        {result.person.display.birthPlace}
                                      </span>
                                    )}
                                    {result.person.display?.deathDate && (
                                      <span className="flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />
                                        Died: {result.person.display.deathDate}
                                      </span>
                                    )}
                                  </div>
                                  
                                  {result.relatedPersons && result.relatedPersons.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-1">
                                      {result.relatedPersons.slice(0, 4).map((rp) => (
                                        <Badge key={rp.id} variant="secondary" className="text-xs">
                                          <Users className="h-3 w-3 mr-1" />
                                          {rp.display?.name || "Unknown"}
                                        </Badge>
                                      ))}
                                      {result.relatedPersons.length > 4 && (
                                        <Badge variant="secondary" className="text-xs">
                                          +{result.relatedPersons.length - 4} more
                                        </Badge>
                                      )}
                                    </div>
                                  )}
                                </div>
                                
                                <div className="flex flex-col gap-2 shrink-0">
                                  <Button 
                                    variant="default" 
                                    size="sm" 
                                    onClick={() => handleImportClick(result)}
                                    data-testid={`button-import-record-${result.id}`}
                                  >
                                    <Download className="h-3 w-3 mr-1" />
                                    Add to Tree
                                  </Button>
                                  <Button variant="outline" size="sm" data-testid={`button-view-record-${result.id}`}>
                                    <ExternalLink className="h-3 w-3 mr-1" />
                                    View
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="import" className="space-y-6">
              {treeData?.isMock && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Demo Mode:</strong> Showing sample data. Connect your FamilySearch account 
                    with an API key to see your real family tree.
                  </AlertDescription>
                </Alert>
              )}

              {!preselectedTreeId && trees.length > 0 && (
                <Card>
                  <CardContent className="py-4">
                    <div className="space-y-2">
                      <Label>Import into tree</Label>
                      <Select value={selectedTreeId} onValueChange={setSelectedTreeId}>
                        <SelectTrigger data-testid="select-import-tree-tab">
                          <SelectValue placeholder="Choose a tree..." />
                        </SelectTrigger>
                        <SelectContent>
                          {trees.map((tree) => (
                            <SelectItem key={tree.id} value={tree.id} data-testid={`select-tree-tab-option-${tree.id}`}>
                              {tree.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              )}

              {preselectedTreeId && (
                <Card>
                  <CardContent className="py-4">
                    <p className="text-sm text-muted-foreground">
                      Importing to: <strong>{trees.find(t => t.id === preselectedTreeId)?.name || "Your tree"}</strong>
                    </p>
                  </CardContent>
                </Card>
              )}

              {treeLoading ? (
                <Card>
                  <CardContent className="py-12">
                    <div className="flex flex-col items-center gap-4">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <p className="text-muted-foreground">Loading your FamilySearch tree...</p>
                    </div>
                  </CardContent>
                </Card>
              ) : treeError ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
                    {((treeError as any)?.message || "").includes("401") || ((treeError as any)?.message || "").includes("expired") ? (
                      <>
                        <p className="text-muted-foreground mb-4">Your FamilySearch session has expired. Please reconnect to continue.</p>
                        <Button onClick={() => connectMutation.mutate()} disabled={connectMutation.isPending} data-testid="button-reconnect-familysearch">
                          {connectMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                          Reconnect to FamilySearch
                        </Button>
                      </>
                    ) : (
                      <p className="text-muted-foreground">Failed to load your FamilySearch tree. Please try again.</p>
                    )}
                  </CardContent>
                </Card>
              ) : treeData && treeData.persons.length <= 1 && treeData.relationships.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Info className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="font-semibold text-lg mb-2">Your FamilySearch Tree is Empty</h3>
                    <p className="text-muted-foreground mb-2">
                      {treeData.persons.length === 1 
                        ? `We found your profile (${treeData.persons[0].name}) but no family members in your FamilySearch tree yet.`
                        : "No family members were found in your FamilySearch tree."
                      }
                    </p>
                    <p className="text-sm text-muted-foreground mb-6">
                      To import family members, first add them to your tree on <a href="https://www.familysearch.org/tree" target="_blank" rel="noopener noreferrer" className="text-primary underline">FamilySearch.org</a>, then come back here to import them.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      You can also use the <button className="text-primary underline" onClick={() => setActiveTab("search")}>Search tab</button> to find and import people from FamilySearch's global database.
                    </p>
                  </CardContent>
                </Card>
              ) : treeData ? (
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between flex-wrap gap-4">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            <TreePine className="h-5 w-5" />
                            Your FamilySearch Tree
                          </CardTitle>
                          <CardDescription className="mt-1">
                            {treeData.persons.length} people found - Select who to import with their relationships
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={selectAll} data-testid="button-select-all">
                            Select All
                          </Button>
                          <Button variant="outline" size="sm" onClick={selectNone} data-testid="button-select-none">
                            Select None
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {renderPersonGroup("You", organizedPersons.self, "self", <User className="h-4 w-4" />)}
                      {renderPersonGroup("Spouse/Partner", organizedPersons.spouses, "spouses", <Users className="h-4 w-4" />)}
                      {renderPersonGroup(`Ancestors (${organizedPersons.ancestors.length})`, organizedPersons.ancestors, "ancestors", <TreePine className="h-4 w-4 rotate-180" />)}
                      {renderPersonGroup(`Descendants (${organizedPersons.descendants.length})`, organizedPersons.descendants, "descendants", <TreePine className="h-4 w-4" />)}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="py-6">
                      <div className="flex items-center justify-between flex-wrap gap-4">
                        <div>
                          <p className="font-medium">
                            {selectedPersons.size} of {treeData.persons.length} people selected
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Relationships between selected people will be preserved
                          </p>
                        </div>
                        <Button 
                          onClick={handleTreeImport}
                          disabled={selectedPersons.size === 0 || treeImportMutation.isPending || (!preselectedTreeId && !selectedTreeId)}
                          data-testid="button-import-selected"
                        >
                          {treeImportMutation.isPending ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Importing...
                            </>
                          ) : (
                            <>
                              <Download className="h-4 w-4 mr-2" />
                              Import Selected People
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : !status?.connected && status?.configured ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Link2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">Connect to FamilySearch</h3>
                    <p className="text-muted-foreground mb-4">
                      Connect your account above to browse and import your family tree.
                    </p>
                  </CardContent>
                </Card>
              ) : null}
            </TabsContent>
          </Tabs>
        </main>
      </div>

      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="sm:max-w-lg" data-testid="dialog-import-record">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TreePine className="h-5 w-5" />
              Add to Tree
            </DialogTitle>
            <DialogDescription>
              {familyMembers.length > 1 
                ? "Select which family members to import along with their relationships."
                : "Add this person as a new member in one of your trees."}
            </DialogDescription>
          </DialogHeader>
          
          {selectedResult && (
            <div className="space-y-4">
              <Card className="bg-muted/50">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <User className="h-4 w-4" />
                    <span className="font-medium">{selectedResult.person.display?.name || "Unknown"}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {selectedResult.person.display?.birthDate && (
                      <span>Born: {selectedResult.person.display.birthDate}</span>
                    )}
                    {selectedResult.person.display?.birthPlace && (
                      <span>{selectedResult.person.display.birthPlace}</span>
                    )}
                    {selectedResult.person.display?.deathDate && (
                      <span>Died: {selectedResult.person.display.deathDate}</span>
                    )}
                    {selectedResult.person.display?.gender && (
                      <span className="capitalize">{selectedResult.person.display.gender}</span>
                    )}
                  </div>
                </CardContent>
              </Card>

              {loadingFamily && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground p-3">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Looking up family members...
                </div>
              )}

              {familyMembers.length > 1 && !loadingFamily && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      Family Members Found ({familyMembers.length})
                    </Label>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-6 px-2"
                        onClick={() => setSelectedFamilyIds(new Set(familyMembers.map(p => p.id)))}
                        data-testid="button-select-all-family"
                      >
                        All
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-6 px-2"
                        onClick={() => setSelectedFamilyIds(new Set([selectedResult.person.id]))}
                        data-testid="button-select-none-family"
                      >
                        Just this person
                      </Button>
                    </div>
                  </div>
                  <div className="max-h-48 overflow-y-auto border rounded-md divide-y">
                    {familyMembers.map((person) => {
                      const isMainPerson = person.id === selectedResult.person.id;
                      const rel = familyRelationships.find(r => 
                        (r.person1Id === selectedResult.person.id && r.person2Id === person.id) ||
                        (r.person2Id === selectedResult.person.id && r.person1Id === person.id)
                      );
                      let relLabel = "";
                      if (isMainPerson) relLabel = "Selected person";
                      else if (rel?.type === "parent-child") {
                        relLabel = rel.person1Id === person.id ? "Parent" : "Child";
                      } else if (rel?.type === "couple") {
                        relLabel = "Spouse";
                      }
                      
                      return (
                        <label
                          key={person.id}
                          className="flex items-center gap-3 p-2 hover:bg-muted/50 cursor-pointer text-sm"
                          data-testid={`family-member-${person.id}`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedFamilyIds.has(person.id)}
                            onChange={() => {
                              setSelectedFamilyIds(prev => {
                                const next = new Set(prev);
                                if (next.has(person.id)) next.delete(person.id);
                                else next.add(person.id);
                                return next;
                              });
                            }}
                            className="rounded"
                            disabled={isMainPerson}
                          />
                          <div className="flex-1 min-w-0">
                            <span className={`${isMainPerson ? "font-medium" : ""}`}>
                              {person.name}
                            </span>
                            {relLabel && (
                              <span className="ml-2 text-xs text-muted-foreground">
                                ({relLabel})
                              </span>
                            )}
                          </div>
                          {person.birthDate && (
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              b. {person.birthDate}
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {selectedFamilyIds.size} of {familyMembers.length} selected
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Select a tree</Label>
                {trees.length === 0 ? (
                  <div className="text-sm text-muted-foreground p-3 border rounded-md">
                    You don't have any trees yet. Create a tree first from your dashboard.
                  </div>
                ) : (
                  <Select value={selectedTreeId} onValueChange={setSelectedTreeId}>
                    <SelectTrigger data-testid="select-import-tree">
                      <SelectValue placeholder="Choose a tree..." />
                    </SelectTrigger>
                    <SelectContent>
                      {trees.map((tree) => (
                        <SelectItem key={tree.id} value={tree.id} data-testid={`select-tree-option-${tree.id}`}>
                          {tree.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md p-3">
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  {familyMembers.length > 1 
                    ? "Selected members will be imported with their relationships preserved."
                    : "This will add the person as a new member. After importing, open your tree and use \"Add Relationship\" to connect them."}
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)} data-testid="button-cancel-import">
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmImport} 
              disabled={!selectedTreeId || searchImportMutation.isPending || trees.length === 0 || selectedFamilyIds.size === 0}
              data-testid="button-confirm-import"
            >
              {searchImportMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Add {selectedFamilyIds.size > 1 ? `${selectedFamilyIds.size} People` : "to Tree"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
