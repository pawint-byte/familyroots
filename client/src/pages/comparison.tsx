import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SEO } from "@/components/seo";
import { ThemeToggle } from "@/components/theme-toggle";
import { 
  ArrowLeft, Check, X, TreePine, Users, Shield, Heart, 
  MapPin, ShoppingBag, Bot, Sparkles, Tag, Layers, Smartphone
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
  { category: "Tree Building", feature: "Unique visual layouts per tree type", familyRoots: true, ancestry: false },
  { category: "Tree Building", feature: "Photo uploads", familyRoots: true, ancestry: true },
  { category: "Tree Building", feature: "Export tree as image", familyRoots: true, ancestry: false },
  { category: "Tree Building", feature: "Life events tracking", familyRoots: true, ancestry: true },
  { category: "Tree Building", feature: "Education & career history", familyRoots: true, ancestry: false },
  { category: "Tree Building", feature: "Name history tracking (maiden, married, etc.)", familyRoots: true, ancestry: false },
  { category: "Tree Building", feature: "Upcoming birthday & gift registry indicators", familyRoots: true, ancestry: false },
  { category: "Tree Building", feature: "Soft delete with 30-day restore", familyRoots: true, ancestry: false },

  { category: "Organization & Structure", feature: "Nested sub-groups (tree-in-tree)", familyRoots: true, ancestry: false },
  { category: "Organization & Structure", feature: "Re-parent / detach sub-groups", familyRoots: true, ancestry: false },
  { category: "Organization & Structure", feature: "Split tree into separate groups", familyRoots: true, ancestry: false },
  { category: "Organization & Structure", feature: "Color-coded member tags", familyRoots: true, ancestry: false },
  { category: "Organization & Structure", feature: "Filter tree view by tag", familyRoots: true, ancestry: false },
  { category: "Organization & Structure", feature: "Create new tree from tagged group", familyRoots: true, ancestry: false },
  { category: "Organization & Structure", feature: "Email tagged members", familyRoots: true, ancestry: false },
  { category: "Organization & Structure", feature: "Bulk tag assignment", familyRoots: true, ancestry: false },

  { category: "Collaboration", feature: "Share trees with others", familyRoots: true, ancestry: true },
  { category: "Collaboration", feature: "Role-based permissions (Viewer/Editor/Co-owner)", familyRoots: true, ancestry: true },
  { category: "Collaboration", feature: "Profile claiming by members", familyRoots: true, ancestry: false },
  { category: "Collaboration", feature: "Custodianship for deceased members", familyRoots: true, ancestry: false },
  { category: "Collaboration", feature: "Invitation links with expiry", familyRoots: true, ancestry: true },
  { category: "Collaboration", feature: "In-tree connection invite links", familyRoots: true, ancestry: false },
  { category: "Collaboration", feature: "Email invitations (via Resend)", familyRoots: true, ancestry: true },
  { category: "Collaboration", feature: "Disassociation protections for tree owners", familyRoots: true, ancestry: false },

  { category: "Privacy & Security", feature: "Private by default (invitation-only)", familyRoots: true, ancestry: false },
  { category: "Privacy & Security", feature: "Three-tier visibility controls", familyRoots: true, ancestry: false },
  { category: "Privacy & Security", feature: "Per-member privacy overrides", familyRoots: true, ancestry: false },
  { category: "Privacy & Security", feature: "Members-only private networks", familyRoots: true, ancestry: false },
  { category: "Privacy & Security", feature: "Labeled, meaningful connections", familyRoots: true, ancestry: false },
  { category: "Privacy & Security", feature: "Member/branch muting", familyRoots: true, ancestry: false },
  { category: "Privacy & Security", feature: "Private trees", familyRoots: true, ancestry: true },
  { category: "Privacy & Security", feature: "Account heir (deadman switch)", familyRoots: true, ancestry: false },

  { category: "Connections & Discovery", feature: "Special connections (godparents, friends, mentors)", familyRoots: true, ancestry: false },
  { category: "Connections & Discovery", feature: "Cross-tree connection requests", familyRoots: true, ancestry: false },
  { category: "Connections & Discovery", feature: "Discoverable community trees", familyRoots: true, ancestry: false },
  { category: "Connections & Discovery", feature: "Smart matching (opt-in)", familyRoots: true, ancestry: true },
  { category: "Connections & Discovery", feature: "Location sharing with map", familyRoots: true, ancestry: false },
  { category: "Connections & Discovery", feature: "Network overview across trees", familyRoots: true, ancestry: false },
  { category: "Connections & Discovery", feature: "Relationship calculator", familyRoots: true, ancestry: true },
  { category: "Connections & Discovery", feature: "Referral system", familyRoots: true, ancestry: false },

  { category: "Records & Research", feature: "FamilySearch record search", familyRoots: true, ancestry: false },
  { category: "Records & Research", feature: "FamilySearch tree import (4 generations)", familyRoots: true, ancestry: false },
  { category: "Records & Research", feature: "Selective member import", familyRoots: true, ancestry: false },
  { category: "Records & Research", feature: "Smart conflict detection (fuzzy matching)", familyRoots: true, ancestry: false },
  { category: "Records & Research", feature: "Smart merge sync (keeps most complete data)", familyRoots: true, ancestry: false },
  { category: "Records & Research", feature: "Linked data transfer during merge", familyRoots: true, ancestry: false },
  { category: "Records & Research", feature: "Spouse preservation on skip", familyRoots: true, ancestry: false },
  { category: "Records & Research", feature: "Post-import integrity verification", familyRoots: true, ancestry: false },
  { category: "Records & Research", feature: "Built-in historical records", familyRoots: false, ancestry: "65+ billion" },
  { category: "Records & Research", feature: "Cemetery records", familyRoots: false, ancestry: true },
  { category: "Records & Research", feature: "Newspaper archives", familyRoots: false, ancestry: true },

  { category: "DNA", feature: "DNA testing", familyRoots: false, ancestry: true },
  { category: "DNA", feature: "DNA matching", familyRoots: false, ancestry: true },
  { category: "DNA", feature: "Ethnicity estimates", familyRoots: false, ancestry: true },

  { category: "AI & Technology", feature: "AI chatbot assistant (GPT-4.1)", familyRoots: true, ancestry: "Beta" },
  { category: "AI & Technology", feature: "AI avatar video generation", familyRoots: true, ancestry: false },
  { category: "AI & Technology", feature: "Multi-language support (4 languages)", familyRoots: true, ancestry: true },
  { category: "AI & Technology", feature: "QR code sharing (profiles, trees, app)", familyRoots: true, ancestry: false },
  { category: "AI & Technology", feature: "Progressive Web App (installable)", familyRoots: true, ancestry: false },
  { category: "AI & Technology", feature: "Membership badge with stats", familyRoots: true, ancestry: false },

  { category: "Beyond Family", feature: "7 tree types (family, church, sports, Greek life, friends, professional, custom)", familyRoots: true, ancestry: false },
  { category: "Beyond Family", feature: "Custom relationship types per tree", familyRoots: true, ancestry: false },
  { category: "Beyond Family", feature: "Qualifier tags on relationships", familyRoots: true, ancestry: false },
  { category: "Beyond Family", feature: "Add your own custom roles", familyRoots: true, ancestry: false },
  { category: "Beyond Family", feature: "Anchor yourself across all your groups", familyRoots: true, ancestry: false },

  { category: "Shopping & Gifts", feature: "Custom merchandise (mugs, shirts, posters)", familyRoots: true, ancestry: false },
  { category: "Shopping & Gifts", feature: "4 print elements (tree, QR, image, text)", familyRoots: true, ancestry: false },
  { category: "Shopping & Gifts", feature: "Gift registries tied to members", familyRoots: true, ancestry: false },
  { category: "Shopping & Gifts", feature: "Curated gift marketplace", familyRoots: true, ancestry: false },

  { category: "Pricing", feature: "Free tier (20 members)", familyRoots: true, ancestry: false },
  { category: "Pricing", feature: "Credits that never expire", familyRoots: true, ancestry: false },
  { category: "Pricing", feature: "Activity rewards & milestones", familyRoots: true, ancestry: false },
  { category: "Pricing", feature: "100-member milestone reward", familyRoots: "Free 10-member pack", ancestry: false },
  { category: "Pricing", feature: "Monthly plans", familyRoots: "Free–$24.99/mo", ancestry: "$20-$50/mo" },
];

const categoryIcons: Record<string, any> = {
  "Tree Building": TreePine,
  "Organization & Structure": Layers,
  "Collaboration": Users,
  "Privacy & Security": Shield,
  "Connections & Discovery": Heart,
  "Records & Research": MapPin,
  "DNA": Sparkles,
  "AI & Technology": Bot,
  "Beyond Family": Tag,
  "Shopping & Gifts": ShoppingBag,
  "Pricing": Smartphone,
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
