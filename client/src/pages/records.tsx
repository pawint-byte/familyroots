import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SEO } from "@/components/seo";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  ArrowLeft, Search, BookOpen, Link2, ExternalLink, 
  User, Calendar, MapPin, FileText, CheckCircle, AlertCircle
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
}

interface FamilySearchStatus {
  configured: boolean;
  connected: boolean;
  displayName: string | null;
  connectedAt: string | null;
}

export default function RecordsPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [searchParams, setSearchParams] = useState({
    givenName: "",
    surname: "",
    birthYear: "",
    birthPlace: "",
    deathYear: "",
    deathPlace: "",
  });
  const [activeSearch, setActiveSearch] = useState(false);

  const { data: status, isLoading: statusLoading } = useQuery<FamilySearchStatus>({
    queryKey: ["/api/familysearch/status"],
    enabled: !!user,
  });

  const { data: results = [], isLoading: searchLoading } = useQuery<SearchResult[]>({
    queryKey: ["/api/familysearch/search", searchParams],
    enabled: activeSearch && !!(searchParams.givenName || searchParams.surname),
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

  const handleSearch = () => {
    if (searchParams.givenName || searchParams.surname) {
      setActiveSearch(true);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setSearchParams(prev => ({ ...prev, [field]: value }));
    setActiveSearch(false);
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <h2 className="text-xl font-semibold mb-2">Sign in Required</h2>
            <p className="text-muted-foreground">Please sign in to search historical records.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <SEO
        title="Historical Records - FamilyRoots"
        description="Search billions of historical records from FamilySearch to discover your ancestors."
      />
      <div className="min-h-screen bg-background">
        <header className="border-b border-border sticky top-0 z-[100] bg-background/95 backdrop-blur">
          <div className="container mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => navigate("/dashboard")} className="gap-2" data-testid="button-back-dashboard">
                <ArrowLeft className="h-4 w-4" />
                Dashboard
              </Button>
              <h1 className="font-serif text-xl font-semibold">Historical Records</h1>
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
                Connect your FamilySearch account to search billions of historical records.
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
                        You can search historical records
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
                          ? "Connect your FamilySearch account to access real records"
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

          <Card className="mb-6" data-testid="card-record-search">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Search Records
              </CardTitle>
              <CardDescription>
                Enter details about the person you're looking for. The more information you provide, the better the results.
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
                            </div>
                            
                            <Button variant="outline" size="sm" data-testid={`button-view-record-${result.id}`}>
                              <ExternalLink className="h-3 w-3 mr-1" />
                              View
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>About Historical Records</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert">
              <p>
                FamilySearch provides free access to over 66 billion historical records from around the world, including:
              </p>
              <ul>
                <li><strong>Birth, Marriage & Death Records</strong> - Vital records from many countries</li>
                <li><strong>Census Records</strong> - Population surveys showing family households</li>
                <li><strong>Immigration Records</strong> - Passenger lists and naturalization documents</li>
                <li><strong>Military Records</strong> - Draft registrations and service records</li>
                <li><strong>Cemetery Records</strong> - Burial and headstone information</li>
              </ul>
              <p className="text-muted-foreground">
                To access real records, register for a free FamilySearch developer account and add your credentials to enable the integration.
              </p>
            </CardContent>
          </Card>
        </main>
      </div>
    </>
  );
}
