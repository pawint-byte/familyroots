import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SEO } from "@/components/seo";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/hooks/use-auth";
import { ArrowLeft, MapPin, Users, Search, Link, Globe } from "lucide-react";
import type { FamilyMember, FamilyTree } from "@shared/schema";

interface NetworkMember {
  member: {
    id: string;
    firstName: string;
    lastName: string;
    photoUrl: string | null;
    currentCity: string | null;
    currentRegion: string | null;
    currentCountry: string | null;
  };
  connectionType: string;
  connectedVia: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

interface LocationMember {
  id: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  currentCity: string | null;
  currentRegion: string | null;
  currentCountry: string | null;
  treeId: string;
}

export default function NetworkPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [searchCity, setSearchCity] = useState("");
  const [searchRegion, setSearchRegion] = useState("");
  const [searchCountry, setSearchCountry] = useState("");
  const [activeSearch, setActiveSearch] = useState(false);

  const { data: trees = [] } = useQuery<FamilyTree[]>({
    queryKey: ["/api/trees"],
    enabled: !!user,
  });

  const { data: locationResults = [], isLoading: searchLoading } = useQuery<LocationMember[]>({
    queryKey: ["/api/members/search/location", { city: searchCity, region: searchRegion, country: searchCountry }],
    enabled: activeSearch && !!(searchCity || searchRegion || searchCountry),
  });

  const handleSearch = () => {
    if (searchCity || searchRegion || searchCountry) {
      setActiveSearch(true);
    }
  };

  const connectionTypeLabels: Record<string, string> = {
    godparent: "Godparent",
    godchild: "Godchild",
    boyfriend: "Boyfriend",
    girlfriend: "Girlfriend",
    fiance: "Fiance",
    fiancee: "Fiancee",
    best_friend: "Best Friend",
    family_friend: "Family Friend",
    mentor: "Mentor",
    mentee: "Mentee",
    guardian: "Guardian",
    ward: "Ward",
    other: "Other",
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <h2 className="text-xl font-semibold mb-2">Sign in Required</h2>
            <p className="text-muted-foreground">Please sign in to view the network.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <SEO
        title="Family Network - FamilyRoots"
        description="Discover family connections and find relatives by location"
      />
      <div className="min-h-screen bg-background">
        <header className="border-b border-border sticky top-0 z-50 bg-background/95 backdrop-blur">
          <div className="container mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => navigate("/dashboard")} className="gap-2" data-testid="button-back-dashboard">
                <ArrowLeft className="h-4 w-4" />
                Dashboard
              </Button>
              <h1 className="font-serif text-xl font-semibold">Family Network</h1>
            </div>
            <ThemeToggle />
          </div>
        </header>

        <main className="container mx-auto px-4 py-8 max-w-4xl">
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Find Family by Location
              </CardTitle>
              <CardDescription>
                Search for family members who have shared their location. Great for finding relatives when traveling!
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    placeholder="e.g., New York"
                    value={searchCity}
                    onChange={(e) => { setSearchCity(e.target.value); setActiveSearch(false); }}
                    data-testid="input-search-city"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="region">State/Province</Label>
                  <Input
                    id="region"
                    placeholder="e.g., California"
                    value={searchRegion}
                    onChange={(e) => { setSearchRegion(e.target.value); setActiveSearch(false); }}
                    data-testid="input-search-region"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    placeholder="e.g., USA"
                    value={searchCountry}
                    onChange={(e) => { setSearchCountry(e.target.value); setActiveSearch(false); }}
                    data-testid="input-search-country"
                  />
                </div>
              </div>
              <Button className="mt-4 gap-2" onClick={handleSearch} data-testid="button-search-location">
                <Search className="h-4 w-4" />
                Search
              </Button>
            </CardContent>
          </Card>

          {activeSearch && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Search Results
                </CardTitle>
              </CardHeader>
              <CardContent>
                {searchLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="flex items-center gap-4">
                        <Skeleton className="h-12 w-12 rounded-full" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-48" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : locationResults.length === 0 ? (
                  <div className="text-center py-8">
                    <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">No Results Found</h3>
                    <p className="text-muted-foreground">
                      No family members have shared their location matching your search.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {locationResults.map((result) => (
                      <Card key={result.id} className="hover-elevate" data-testid={`location-result-${result.id}`}>
                        <CardContent className="p-4 flex items-center gap-4">
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={result.photoUrl || undefined} />
                            <AvatarFallback className="bg-primary/10 text-primary">
                              {result.firstName[0]}{result.lastName?.[0] || ""}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <p className="font-medium">{result.firstName} {result.lastName}</p>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              {[result.currentCity, result.currentRegion, result.currentCountry]
                                .filter(Boolean)
                                .join(", ")}
                            </div>
                          </div>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => navigate(`/tree/${result.treeId}`)}
                            data-testid={`button-view-tree-${result.id}`}
                          >
                            View Tree
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <div className="mt-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  About the Network
                </CardTitle>
              </CardHeader>
              <CardContent className="prose prose-sm dark:prose-invert">
                <p>
                  The Family Network helps you discover and connect with people who matter. You can:
                </p>
                <ul>
                  <li><strong>Add Special Connections</strong> - Link godparents, best friends, mentors, and significant others to family members</li>
                  <li><strong>Share Your Location</strong> - Optionally share your city so relatives can find you when traveling</li>
                  <li><strong>Request Connections</strong> - Send connection requests to people in other family trees</li>
                  <li><strong>Explore Networks</strong> - See connections of your connections with limited info for privacy</li>
                </ul>
                <p className="text-muted-foreground">
                  All location sharing is opt-in. Only share your location if you want family members to be able to find you.
                </p>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </>
  );
}
