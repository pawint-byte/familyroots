import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SEO } from "@/components/seo";
import { ArrowLeft, Sparkles, Wrench, Zap, Star } from "lucide-react";

type UpdateType = "new" | "improved" | "fix";

interface Update {
  title: string;
  description: string;
  type: UpdateType;
  category?: string;
}

interface Release {
  version: string;
  date: string;
  headline: string;
  updates: Update[];
}

const getTypeBadge = (type: UpdateType) => {
  switch (type) {
    case "new":
      return <Badge className="bg-green-500/10 text-green-600 border-green-500/20 gap-1" variant="outline" data-testid={`badge-type-${type}`}><Sparkles className="h-3 w-3" />New</Badge>;
    case "improved":
      return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 gap-1" variant="outline" data-testid={`badge-type-${type}`}><Zap className="h-3 w-3" />Improved</Badge>;
    case "fix":
      return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 gap-1" variant="outline" data-testid={`badge-type-${type}`}><Wrench className="h-3 w-3" />Fixed</Badge>;
  }
};

const releases: Release[] = [
  {
    version: "2.4",
    date: "February 24, 2026",
    headline: "Tree-level Gift Registries, Enhanced Timeline, and Site Content Updates",
    updates: [
      {
        title: "Gift Registries Tab in Tree View",
        description: "Browse all active and past gift registries across your entire tree from one place. See member photos, event types, countdown badges, and fulfillment progress at a glance.",
        type: "new",
        category: "Gift Registries",
      },
      {
        title: "Enhanced Family Timeline",
        description: "The Timeline tab now shows all life events — marriages, graduations, baptisms, career milestones — alongside births and deaths. Each event type has its own color-coded icon, and events include locations and descriptions.",
        type: "improved",
        category: "Timeline",
      },
      {
        title: "Memory Lane Tab",
        description: "A new Memories tab in tree view where members can share stories, milestones, traditions, funny moments, and life lessons with photo support. Five categories help organize your family's shared history.",
        type: "new",
        category: "Premium Content",
      },
      {
        title: "Voice Notes on Member Profiles",
        description: "Record and play audio notes directly on any member's profile. Preserve the voices of loved ones and attach personal messages using your browser's microphone.",
        type: "new",
        category: "Premium Content",
      },
      {
        title: "Annual Tree Report",
        description: "A new Report tab showing yearly statistics — member counts, relationship breakdowns, milestone birthdays, growth trends, and event summaries. View reports for any past year.",
        type: "new",
        category: "Premium Content",
      },
      {
        title: "Updated FAQ, Features Guide & Landing Page",
        description: "All site content now accurately describes where to find every feature, including the new tree view tabs (Memories, Report, Registries, Timeline) and updated gift registry instructions.",
        type: "improved",
        category: "Site Content",
      },
    ],
  },
  {
    version: "2.3",
    date: "February 2026",
    headline: "FamilySearch True Sync and Deep Conflict Resolution",
    updates: [
      {
        title: "True Bidirectional Merge During FamilySearch Import",
        description: "When merging duplicate members, the system now keeps the most complete data from both sides. If only one side has a field, it's always kept. If both sides differ, the more specific value wins and alternates are preserved.",
        type: "improved",
        category: "FamilySearch",
      },
      {
        title: "Full Linked Record Transfer",
        description: "Merging members now transfers all 16 types of linked records — life events, education, career, name history, tags, FamilySearch sources, external IDs, special connections, gift registries, voice notes, memories, invitations, claims, custodianship, mutes, and discoverable entries.",
        type: "new",
        category: "FamilySearch",
      },
      {
        title: "Spouse Preservation During Skip",
        description: "When skipping a duplicate during import, spouse relationships are now re-routed to the equivalent existing member. The spouse is also made a co-parent of any children to maintain family structure.",
        type: "improved",
        category: "FamilySearch",
      },
      {
        title: "Post-Resolution Integrity Check",
        description: "After conflict resolution, the system verifies every relationship, traces ancestor chains with cycle detection, and shows a detailed summary of all data preserved — including chain depth, transfer counts, and relationship type breakdowns.",
        type: "new",
        category: "FamilySearch",
      },
      {
        title: "Great-Grandparent Connections Preserved",
        description: "Restructured the resolve-conflicts flow to move all members and relationships into the target tree before processing merges and skips. This ensures distant ancestor connections (great-grandparents and beyond) are never lost.",
        type: "fix",
        category: "FamilySearch",
      },
    ],
  },
  {
    version: "2.2",
    date: "February 2026",
    headline: "Tree Splitting, Connection Request Routing, and Tiered Pricing",
    updates: [
      {
        title: "Tree Splitting",
        description: "Owners and co-owners can split a tree by selecting members to move into a new tree. Relationships within the group are preserved, cross-tree connections are cleaned up, and trees can be optionally linked.",
        type: "new",
        category: "Trees",
      },
      {
        title: "Connection Request Routing with Tree Context",
        description: "Connection requests now carry full tree context — both sender and receiver know which tree the request targets. Incoming requests show the tree name and link, and approved connections route to the correct tree.",
        type: "improved",
        category: "Networking",
      },
      {
        title: "In-Tree Connection Invite Links",
        description: "Tree owners can copy a connection invite link from their tree. Recipients land on a page showing the tree name, type, and owner, and can pick their role and send a request without needing to search.",
        type: "new",
        category: "Networking",
      },
      {
        title: "Tiered Pricing System",
        description: "Four subscription tiers — Explorer (free), Cultivator ($4.99/mo), Heritage ($12.99/mo), Legacy ($24.99/mo) — with monthly usage limits for AI Chat, FamilySearch Import, Group Email, AI Video, and Media Upload.",
        type: "new",
        category: "Pricing",
      },
      {
        title: "Member Pack Purchases",
        description: "All tiers include 20 free members. Beyond that, buy one-time member packs (10/$7.99, 25/$14.99, 50/$24.99). Credits never expire. Rewards for active users: 20% off for 5+ monthly adds, free 10-pack at 100 members.",
        type: "new",
        category: "Pricing",
      },
    ],
  },
  {
    version: "2.1",
    date: "January 2026",
    headline: "Tags, Upcoming Event Badges, and Sub-group Management",
    updates: [
      {
        title: "Tree & Member Tagging",
        description: "Create color-coded tags at the tree level and assign them to members. Filter the tree view by tag, create new trees from tagged groups, and email tagged members. Tags are visible on dashboard cards and tree headers.",
        type: "new",
        category: "Trees",
      },
      {
        title: "Upcoming Birthday & Registry Badges",
        description: "Member cards now show badge indicators for upcoming birthdays (within 30 days, with countdown) and active gift registries. No setup needed beyond adding birth dates.",
        type: "new",
        category: "Trees",
      },
      {
        title: "Nested Sub-groups",
        description: "Create hierarchical sub-groups within trees (e.g., 'Class of 2025' within a school tree). Supports re-parenting and detaching sub-groups, with circular reference prevention.",
        type: "new",
        category: "Trees",
      },
    ],
  },
  {
    version: "2.0",
    date: "January 2026",
    headline: "Multi-Tree Types, FamilySearch Integration, and Merchandise",
    updates: [
      {
        title: "Multi-Tree Type Support",
        description: "Beyond family trees, create trees for church groups, sports teams, professional networks, schools, and more. Each type has unique relationship types, terminology, visual layouts, and accent colors.",
        type: "new",
        category: "Trees",
      },
      {
        title: "FamilySearch Integration",
        description: "Search 66 billion+ historical records and import entire family branches with relationships intact. Smart conflict detection finds duplicates automatically with side-by-side comparison.",
        type: "new",
        category: "FamilySearch",
      },
      {
        title: "Custom Merchandise",
        description: "Order print-on-demand items featuring your tree — mugs, t-shirts, posters, blankets, and more. Customize with tree prints, QR codes, and custom text. Powered by Printful.",
        type: "new",
        category: "Merchandise",
      },
      {
        title: "QR Code Sharing",
        description: "Share app links, profiles, and tree invitations via QR codes. Perfect for family reunions and in-person connections.",
        type: "new",
        category: "Sharing",
      },
      {
        title: "AI Chat Assistant",
        description: "An OpenAI-powered chatbot for genealogy questions, relationship term explanations, research tips, and feature guidance. Available from any page.",
        type: "new",
        category: "AI",
      },
    ],
  },
];

export default function WhatsNew() {
  const [, navigate] = useLocation();

  return (
    <>
      <SEO
        title="What's New - FamilyRoots"
        description="See the latest features, improvements, and updates to FamilyRoots. Track how the platform evolves to help you build and manage your family tree."
      />
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-3xl">
          <div className="flex items-center gap-3 mb-8">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")} data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="font-serif text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
                <Star className="h-7 w-7 text-primary" />
                What's New
              </h1>
              <p className="text-muted-foreground mt-1">
                Track how FamilyRoots is evolving with every update.
              </p>
            </div>
          </div>

          <div className="space-y-12">
            {releases.map((release, releaseIdx) => (
              <div key={release.version} data-testid={`release-${release.version}`}>
                <div className="flex items-center gap-3 mb-2">
                  <Badge variant="default" className="text-sm px-3 py-1" data-testid={`badge-version-${release.version}`}>
                    v{release.version}
                  </Badge>
                  <span className="text-sm text-muted-foreground">{release.date}</span>
                  {releaseIdx === 0 && (
                    <Badge className="bg-green-500/10 text-green-600 border-green-500/20" variant="outline">Latest</Badge>
                  )}
                </div>
                <h2 className="font-serif text-xl font-semibold mb-4" data-testid={`text-release-headline-${release.version}`}>
                  {release.headline}
                </h2>

                <div className="space-y-3">
                  {release.updates.map((update, updateIdx) => (
                    <Card key={updateIdx} className="hover-elevate" data-testid={`update-${release.version}-${updateIdx}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="shrink-0 mt-0.5">
                            {getTypeBadge(update.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <h3 className="font-medium">{update.title}</h3>
                              {update.category && (
                                <Badge variant="secondary" className="text-xs">{update.category}</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">{update.description}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {releaseIdx < releases.length - 1 && (
                  <div className="border-b border-border mt-12" />
                )}
              </div>
            ))}
          </div>

          <div className="mt-16 text-center">
            <p className="text-muted-foreground text-sm">
              Have a feature request or idea? Let us know through the AI chat assistant on any page.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
