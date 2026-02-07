import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SEO } from "@/components/seo";
import { ThemeToggle } from "@/components/theme-toggle";
import { 
  ArrowLeft, Check, X, TreePine, Users, Shield, Heart, 
  MapPin, ShoppingBag, Bot, Sparkles
} from "lucide-react";

interface FeatureRow {
  feature: string;
  familyRoots: boolean | string;
  ancestry: boolean | string;
  category: string;
}

const features: FeatureRow[] = [
  { category: "Tree Building", feature: "Create family trees", familyRoots: true, ancestry: true },
  { category: "Tree Building", feature: "Visual tree display", familyRoots: true, ancestry: true },
  { category: "Tree Building", feature: "Photo uploads", familyRoots: true, ancestry: true },
  { category: "Tree Building", feature: "Export tree as image", familyRoots: true, ancestry: false },
  { category: "Tree Building", feature: "Life events tracking", familyRoots: true, ancestry: true },
  { category: "Tree Building", feature: "Education & career history", familyRoots: true, ancestry: false },
  
  { category: "Collaboration", feature: "Share trees with others", familyRoots: true, ancestry: true },
  { category: "Collaboration", feature: "Role-based permissions", familyRoots: true, ancestry: true },
  { category: "Collaboration", feature: "Profile claiming", familyRoots: true, ancestry: false },
  { category: "Collaboration", feature: "Custodianship for deceased", familyRoots: true, ancestry: false },
  { category: "Collaboration", feature: "Invitation links with expiry", familyRoots: true, ancestry: true },
  
  { category: "Privacy & Security", feature: "Members-only private networks", familyRoots: true, ancestry: false },
  { category: "Privacy & Security", feature: "Three-tier visibility controls", familyRoots: true, ancestry: false },
  { category: "Privacy & Security", feature: "Invitation-only group access", familyRoots: true, ancestry: false },
  { category: "Privacy & Security", feature: "Role-based privacy per member", familyRoots: true, ancestry: false },
  { category: "Privacy & Security", feature: "Labeled, meaningful connections", familyRoots: true, ancestry: false },
  { category: "Privacy & Security", feature: "Private trees", familyRoots: true, ancestry: true },
  { category: "Privacy & Security", feature: "Account heir (deadman switch)", familyRoots: true, ancestry: false },
  
  { category: "Connections", feature: "Special connections (godparents, friends)", familyRoots: true, ancestry: false },
  { category: "Connections", feature: "Location sharing with map", familyRoots: true, ancestry: false },
  { category: "Connections", feature: "Cross-tree connection requests", familyRoots: true, ancestry: false },
  { category: "Connections", feature: "Network discovery", familyRoots: true, ancestry: false },
  { category: "Connections", feature: "Relationship calculator", familyRoots: true, ancestry: true },
  
  { category: "Records & Research", feature: "Historical records database", familyRoots: "Coming Soon", ancestry: "65+ billion" },
  { category: "Records & Research", feature: "Automated hints/matches", familyRoots: "Coming Soon", ancestry: true },
  { category: "Records & Research", feature: "Cemetery records", familyRoots: false, ancestry: true },
  { category: "Records & Research", feature: "Newspaper archives", familyRoots: false, ancestry: true },
  
  { category: "DNA", feature: "DNA testing", familyRoots: false, ancestry: true },
  { category: "DNA", feature: "DNA matching", familyRoots: false, ancestry: true },
  { category: "DNA", feature: "Ethnicity estimates", familyRoots: false, ancestry: true },
  
  { category: "AI & Technology", feature: "AI chatbot assistance", familyRoots: true, ancestry: "Beta" },
  { category: "AI & Technology", feature: "AI video generation", familyRoots: true, ancestry: false },
  { category: "AI & Technology", feature: "Multi-language support", familyRoots: true, ancestry: true },
  { category: "AI & Technology", feature: "QR code sharing", familyRoots: true, ancestry: false },
  
  { category: "Beyond Family", feature: "Multi-type trees (church, sports, Greek life)", familyRoots: true, ancestry: false },
  { category: "Beyond Family", feature: "Custom relationship types per tree", familyRoots: true, ancestry: false },
  { category: "Beyond Family", feature: "Professional network trees", familyRoots: true, ancestry: false },
  
  { category: "Monetization", feature: "Credit-based member packs (no expiry)", familyRoots: true, ancestry: false },
  { category: "Monetization", feature: "Activity rewards & milestones", familyRoots: true, ancestry: false },
  { category: "Monetization", feature: "Custom merchandise (print-on-demand)", familyRoots: true, ancestry: false },
  { category: "Monetization", feature: "Gift marketplace", familyRoots: true, ancestry: false },
];

const categoryIcons: Record<string, any> = {
  "Tree Building": TreePine,
  "Collaboration": Users,
  "Privacy & Security": Shield,
  "Connections": Heart,
  "Records & Research": MapPin,
  "DNA": Sparkles,
  "AI & Technology": Bot,
  "Beyond Family": Sparkles,
  "Monetization": ShoppingBag,
};

function FeatureValue({ value }: { value: boolean | string }) {
  if (value === true) {
    return <Check className="h-5 w-5 text-green-500" />;
  }
  if (value === false) {
    return <X className="h-5 w-5 text-muted-foreground" />;
  }
  return <Badge variant="secondary">{value}</Badge>;
}

export default function ComparisonPage() {
  const [, navigate] = useLocation();

  const categories = Array.from(new Set(features.map(f => f.category)));

  const familyRootsAdvantages = features.filter(f => 
    f.familyRoots === true && f.ancestry === false
  ).length;

  const ancestryAdvantages = features.filter(f => 
    f.ancestry === true && f.familyRoots === false
  ).length;

  return (
    <>
      <SEO
        title="FamilyRoots vs Ancestry - Private Networks vs Traditional Genealogy"
        description="See how FamilyRoots private networks compare to Ancestry.com. Members-only access, labeled connections, and multi-group support vs traditional genealogy."
      />
      <div className="min-h-screen bg-background">
        <header className="border-b border-border sticky top-0 z-[100] bg-background/95 backdrop-blur">
          <div className="container mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => navigate("/")} className="gap-2" data-testid="button-back-home">
                <ArrowLeft className="h-4 w-4" />
                Home
              </Button>
              <h1 className="font-serif text-xl font-semibold">Feature Comparison</h1>
            </div>
            <ThemeToggle />
          </div>
        </header>

        <main className="container mx-auto px-4 py-8 max-w-5xl">
          <div className="text-center mb-8">
            <h1 className="font-serif text-3xl md:text-4xl font-bold mb-4">
              FamilyRoots vs Ancestry
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              FamilyRoots is a private, members-only network where connections are labeled and meaningful. See how it compares to traditional genealogy platforms.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-8">
            <Card className="border-primary" data-testid="card-summary-familyroots">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2">
                  <TreePine className="h-5 w-5 text-primary" />
                  FamilyRoots
                </CardTitle>
                <CardDescription>Modern family connection platform</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <span className="text-3xl font-bold text-primary" data-testid="text-familyroots-advantages">{familyRootsAdvantages}</span>
                  <span className="text-muted-foreground">unique features</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Focus: Living family connections, collaboration, and modern features
                </p>
              </CardContent>
            </Card>

            <Card data-testid="card-summary-ancestry">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Ancestry
                </CardTitle>
                <CardDescription>Historical research platform</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <span className="text-3xl font-bold" data-testid="text-ancestry-advantages">{ancestryAdvantages}</span>
                  <span className="text-muted-foreground">unique features</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Focus: Historical records, DNA testing, and ancestry research
                </p>
              </CardContent>
            </Card>
          </div>

          {categories.map((category) => {
            const categoryFeatures = features.filter(f => f.category === category);
            const Icon = categoryIcons[category] || TreePine;
            
            return (
              <Card key={category} className="mb-6" data-testid={`card-category-${category.toLowerCase().replace(/\s+/g, '-')}`}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg" data-testid={`title-category-${category.toLowerCase().replace(/\s+/g, '-')}`}>
                    <Icon className="h-5 w-5 text-primary" />
                    {category}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full" data-testid={`table-${category.toLowerCase().replace(/\s+/g, '-')}`}>
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 pr-4 font-medium">Feature</th>
                          <th className="text-center py-2 px-4 font-medium min-w-[120px]">
                            <span className="text-primary">FamilyRoots</span>
                          </th>
                          <th className="text-center py-2 pl-4 font-medium min-w-[120px]">Ancestry</th>
                        </tr>
                      </thead>
                      <tbody>
                        {categoryFeatures.map((row, index) => (
                          <tr key={index} className="border-b last:border-0" data-testid={`row-feature-${row.feature.toLowerCase().replace(/\s+/g, '-')}`}>
                            <td className="py-3 pr-4" data-testid={`text-feature-name-${index}`}>{row.feature}</td>
                            <td className="py-3 px-4 text-center" data-testid={`value-familyroots-${index}`}>
                              <div className="flex justify-center">
                                <FeatureValue value={row.familyRoots} />
                              </div>
                            </td>
                            <td className="py-3 pl-4 text-center" data-testid={`value-ancestry-${index}`}>
                              <div className="flex justify-center">
                                <FeatureValue value={row.ancestry} />
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-6">
              <div className="text-center">
                <h3 className="font-serif text-xl font-semibold mb-2">Ready to try FamilyRoots?</h3>
                <p className="text-muted-foreground mb-4">
                  Start building your family tree today with our modern, collaborative platform.
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                  <Button onClick={() => navigate("/")} data-testid="button-get-started">
                    Get Started Free
                  </Button>
                  <Button variant="outline" onClick={() => navigate("/pricing")} data-testid="button-view-pricing">
                    View Pricing
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </>
  );
}
