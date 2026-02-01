import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SEO } from "@/components/seo";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  ArrowLeft, Download, Users, TreePine, CheckCircle, 
  AlertCircle, Link2, User, Calendar, MapPin, Loader2,
  ChevronDown, ChevronRight, Info
} from "lucide-react";

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

interface FamilySearchStatus {
  configured: boolean;
  connected: boolean;
  displayName: string | null;
  connectedAt: string | null;
}

interface FamilyTree {
  id: string;
  name: string;
}

export default function FamilySearchImportPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const params = useParams<{ treeId?: string }>();
  
  const [selectedPersons, setSelectedPersons] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(["ancestors", "descendants", "self"]));

  const { data: status, isLoading: statusLoading } = useQuery<FamilySearchStatus>({
    queryKey: ["/api/familysearch/status"],
    enabled: !!user,
  });

  const { data: trees = [] } = useQuery<FamilyTree[]>({
    queryKey: ["/api/trees"],
    enabled: !!user,
  });

  const { data: treeData, isLoading: treeLoading, error: treeError } = useQuery<TreeData>({
    queryKey: ["/api/familysearch/tree"],
    enabled: !!user && (status?.connected || !status?.configured),
  });

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

  const importMutation = useMutation({
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
      const targetTreeId = params.treeId || trees[0]?.id;
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
    const personMap = new Map(persons.map(p => [p.id, p]));
    
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

  const toggleGroup = (group: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
      return next;
    });
  };

  const togglePerson = (id: string) => {
    setSelectedPersons(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (treeData) {
      setSelectedPersons(new Set(treeData.persons.map(p => p.id)));
    }
  };

  const selectNone = () => {
    setSelectedPersons(new Set());
  };

  const handleImport = () => {
    const targetTreeId = params.treeId || trees[0]?.id;
    if (!targetTreeId) {
      toast({
        title: "No Tree Selected",
        description: "Please create a family tree first before importing.",
        variant: "destructive",
      });
      return;
    }
    
    if (selectedPersons.size === 0) {
      toast({
        title: "No People Selected",
        description: "Please select at least one person to import.",
        variant: "destructive",
      });
      return;
    }
    
    const personsToImport = treeData!.persons.filter(p => selectedPersons.has(p.id));
    const relationshipsToImport = treeData!.relationships.filter(
      r => selectedPersons.has(r.person1Id) && selectedPersons.has(r.person2Id)
    );
    
    importMutation.mutate({
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
      <div className="container mx-auto py-8 px-4">
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Please sign in to import from FamilySearch.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <SEO 
        title="Import from FamilySearch"
        description="Import your family tree from FamilySearch into FamilyRoots"
      />
      
      <div className="mb-6">
        <Button 
          variant="ghost" 
          onClick={() => navigate(params.treeId ? `/tree/${params.treeId}` : "/dashboard")}
          className="mb-4"
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        
        <h1 className="text-3xl font-bold">Import from FamilySearch</h1>
        <p className="text-muted-foreground mt-2">
          Connect your FamilySearch account to import your family tree data
        </p>
      </div>

      {statusLoading ? (
        <Card>
          <CardContent className="py-8">
            <Skeleton className="h-8 w-48 mx-auto" />
          </CardContent>
        </Card>
      ) : !status?.connected && status?.configured ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Connect to FamilySearch
            </CardTitle>
            <CardDescription>
              Sign in with your FamilySearch account to access your family tree data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => connectMutation.mutate()}
              disabled={connectMutation.isPending}
              data-testid="button-connect-familysearch"
            >
              {connectMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Link2 className="h-4 w-4 mr-2" />
                  Connect FamilySearch Account
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {treeData?.isMock && (
            <Alert className="mb-6">
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Demo Mode:</strong> Showing sample data. Connect your FamilySearch account 
                with an API key to see your real family tree.
              </AlertDescription>
            </Alert>
          )}
          
          {status?.connected && (
            <Card className="mb-6">
              <CardContent className="py-4">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <div className="flex-1">
                    <p className="font-medium">Connected to FamilySearch</p>
                    {status.displayName && (
                      <p className="text-sm text-muted-foreground">Signed in as {status.displayName}</p>
                    )}
                  </div>
                </div>
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
                <p className="text-muted-foreground">Failed to load your FamilySearch tree. Please try again.</p>
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
                        {treeData.persons.length} people found • Select who to import
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
                      {trees.length > 0 && (
                        <p className="text-sm text-muted-foreground">
                          Importing to: <strong>{trees.find(t => t.id === (params.treeId || trees[0]?.id))?.name || "Your tree"}</strong>
                        </p>
                      )}
                    </div>
                    <Button 
                      onClick={handleImport}
                      disabled={selectedPersons.size === 0 || importMutation.isPending}
                      data-testid="button-import"
                    >
                      {importMutation.isPending ? (
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
          ) : null}
        </>
      )}
    </div>
  );
}
