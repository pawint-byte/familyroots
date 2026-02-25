import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import { SEO } from "@/components/seo";
import {
  TreeDeciduous, ArrowLeft, Users, Shield, Sparkles, Tag, Gift, User, Heart, Zap,
  Church, Trophy, GraduationCap, Briefcase, BookOpen, QrCode, Share2, Globe, MapPin,
  Search, Bell, Camera, Palette, ShoppingBag, Video, Bot, Link2, Layers, Split,
  Settings, Eye, Lock, Mail, Award, UserCheck, ScrollText, Network, GitMerge, CheckCircle2, FileCheck,
  Star, ArrowRight, Crown, BookHeart, Mic, BarChart3
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface FeatureEntry {
  name: string;
  description: string;
  whereToFind: string;
  icon: React.ReactNode;
}

interface FeatureCategory {
  title: string;
  icon: React.ReactNode;
  features: FeatureEntry[];
}

export default function FeaturesGuide() {
  const categories: FeatureCategory[] = [
    {
      title: "Trees & Organization",
      icon: <TreeDeciduous className="h-5 w-5" />,
      features: [
        {
          name: "Multi-Tree Types",
          description: "Create different kinds of trees beyond family - church groups, sports teams, fraternities, professional networks, friend circles, and fully custom groups. Each type has its own relationship labels and visual style.",
          whereToFind: "Dashboard > Create New Tree > choose your tree type from the dropdown.",
          icon: <TreeDeciduous className="h-5 w-5 text-green-600" />,
        },
        {
          name: "Nested Sub-groups",
          description: "Organize trees into parent-child hierarchies. For example, a school tree can have \"Class of 2025\" as a sub-group. You can move existing trees under another tree or detach them to stand alone again.",
          whereToFind: "Tree View > Settings (gear icon) > Parent Tree section. Use 'Set Parent' to nest or 'Detach' to separate.",
          icon: <Layers className="h-5 w-5 text-blue-600" />,
        },
        {
          name: "Tree Splitting",
          description: "Reorganize your tree by selecting specific members to move into a brand new tree. Relationships within the group are kept, cross-tree relationships are removed, and all member data (events, invitations) moves with them.",
          whereToFind: "Tree View > Settings (gear icon) > Split Tree button. Select members to move, name the new tree, and confirm.",
          icon: <Split className="h-5 w-5 text-orange-600" />,
        },
        {
          name: "Clone Tree",
          description: "Create a complete duplicate of any tree you own or co-own. All members, relationships, and tags are copied with new IDs. Perfect for creating tree variations like 'immediate family' vs 'extended family' without re-entering data.",
          whereToFind: "Tree View > More Options (three dots menu) > 'Clone Tree'. Name the copy and confirm.",
          icon: <Layers className="h-5 w-5 text-cyan-600" />,
        },
        {
          name: "Save & Restore Layout",
          description: "Drag tree nodes to arrange them exactly how you want, then save the layout so it looks the same every time you come back. New members that are added later get auto-positioned while your saved layout stays intact.",
          whereToFind: "Drag any node to reposition it. A 'Save Layout' button appears in the zoom controls when positions have changed. Click it to save.",
          icon: <Eye className="h-5 w-5 text-teal-600" />,
        },
        {
          name: "Tree Tags",
          description: "Add color-coded labels to your trees for quick identification and organization. Tags like 'Class of 2025', 'Chapter Alpha', or 'Active' appear on dashboard cards and tree headers.",
          whereToFind: "Tree View > click the tag icon next to the tree name, or open 'Manage Tags' from the tree header.",
          icon: <Tag className="h-5 w-5 text-indigo-600" />,
        },
        {
          name: "Member Tags",
          description: "Assign tree-level tags to individual members for granular organization. Tag multiple members at once using the bulk assignment tool. Click any tag in the header to filter the tree view to just those tagged members.",
          whereToFind: "Tree View > click a member > scroll to Tags section to toggle tags on/off. For bulk: Manage Tags dialog > Bulk Assignment tab. Filter: click any tag badge in the tree header.",
          icon: <Tag className="h-5 w-5 text-purple-600" />,
        },
        {
          name: "Create Tree from Tag",
          description: "Turn a tagged group into its own tree. All members with that tag are moved into a new tree, which can be a standalone tree or a sub-group of the original. Great for organizing chapters, classes, or teams into their own manageable groups.",
          whereToFind: "Tree View > Manage Tags dialog > click 'Create Tree' next to any tag that has members assigned.",
          icon: <TreeDeciduous className="h-5 w-5 text-emerald-600" />,
        },
        {
          name: "Email Tagged Group",
          description: "Send a message directly to all members with a specific tag who have email addresses on file. Perfect for communicating with a chapter, class year, or team without emailing the entire tree.",
          whereToFind: "Tree View > Manage Tags dialog > click 'Email' next to any tag that has members with email addresses.",
          icon: <Mail className="h-5 w-5 text-blue-500" />,
        },
        {
          name: "Visual Layouts",
          description: "Each tree type has a unique visual appearance with distinct accent colors, connection line styles, and node shapes. The visual hierarchy is based on relationship importance.",
          whereToFind: "Automatic based on tree type. Family trees use classic style, church trees use warm colors, sports teams use bold accent colors, etc.",
          icon: <Palette className="h-5 w-5 text-pink-600" />,
        },
      ],
    },
    {
      title: "Members & Profiles",
      icon: <Users className="h-5 w-5" />,
      features: [
        {
          name: "Add Members",
          description: "Add people to your tree with their name, photo, birth date, and other details. You can also add 'unknown' placeholders for people whose details you don't know yet. Tags can be assigned during or after creation.",
          whereToFind: "Tree View > 'Add Member' button in the header toolbar.",
          icon: <User className="h-5 w-5 text-blue-600" />,
        },
        {
          name: "Profile Claiming",
          description: "Members added by others can claim their own profile to take ownership. Once claimed, they can edit their own information directly. Disassociation protections prevent unwanted removals.",
          whereToFind: "Tree View > click your name > 'Claim Profile' button (appears if you haven't claimed it yet).",
          icon: <UserCheck className="h-5 w-5 text-green-600" />,
        },
        {
          name: "Custodianship",
          description: "Manage profiles of deceased family members. A custodian can update information, add photos, and record life events on behalf of someone who has passed.",
          whereToFind: "Tree View > click a deceased member > 'Request Custodianship' in their profile panel.",
          icon: <Heart className="h-5 w-5 text-rose-600" />,
        },
        {
          name: "Life Events & Timeline",
          description: "Record important milestones like graduations, weddings, military service, baptisms, and more on individual member profiles. All life events across the tree — plus every member's birth and death dates — are gathered into the Timeline tab, displayed chronologically with color-coded icons, member photos, locations, and year groupings.",
          whereToFind: "Add events: Tree View > click a member > 'Life Events' section > 'Add Event'. View all: Tree View > 'Timeline' tab.",
          icon: <ScrollText className="h-5 w-5 text-amber-600" />,
        },
        {
          name: "Education & Career History",
          description: "Track schools attended, degrees earned, jobs held, and professional achievements for each member.",
          whereToFind: "Tree View > click a member > Education and Career sections in the profile panel.",
          icon: <GraduationCap className="h-5 w-5 text-blue-600" />,
        },
        {
          name: "Photo Upload",
          description: "Upload profile photos for each member. Photos are stored securely and displayed on tree nodes and profile cards.",
          whereToFind: "Tree View > click a member > Edit > click the photo area or upload button.",
          icon: <Camera className="h-5 w-5 text-cyan-600" />,
        },
        {
          name: "Name History",
          description: "Track name changes throughout a member's life — birth names, married names, names after divorce, or adoption names. A timeline shows when each name was used.",
          whereToFind: "Tree View > click a member > scroll to 'Name History' section in the profile panel.",
          icon: <ScrollText className="h-5 w-5 text-indigo-500" />,
        },
        {
          name: "Upcoming Event Indicators",
          description: "Member cards in the tree show small badge indicators for upcoming birthdays (within 30 days, with countdown) and active gift registries. Quickly see who has a birthday coming up or who has a registry at a glance.",
          whereToFind: "Visible directly on member cards in the tree visualization (automatic), plus the Registries tab shows all active registries across the tree.",
          icon: <Bell className="h-5 w-5 text-red-500" />,
        },
        {
          name: "Soft Delete & Restore",
          description: "Deleted trees and members are kept for 30 days in a 'Recently Deleted' area before permanent removal. Restore anything you accidentally deleted within that window.",
          whereToFind: "Dashboard > scroll to 'Recently Deleted' section. For members: Tree View > Settings > 'Deleted Members'.",
          icon: <Award className="h-5 w-5 text-gray-500" />,
        },
      ],
    },
    {
      title: "Relationships",
      icon: <Link2 className="h-5 w-5" />,
      features: [
        {
          name: "Relationship Types",
          description: "Each tree type has its own set of relationship labels. Family trees use Parent, Child, Spouse, Sibling. Church trees use Pastor, Deacon, etc. Sports teams use Coach, Captain, Player.",
          whereToFind: "Tree View > click a member > 'Add Relationship' button > choose the relationship type and select the other person.",
          icon: <Link2 className="h-5 w-5 text-purple-600" />,
        },
        {
          name: "Manage Relationships",
          description: "View and edit all relationships across your trees. Remove incorrect connections or change relationship types.",
          whereToFind: "Dashboard > menu (top right) > 'Manage Relationships'. Or Tree View > click a member > scroll to Relationships section.",
          icon: <Settings className="h-5 w-5 text-gray-600" />,
        },
        {
          name: "Special Connections",
          description: "Define non-standard relationships like godparents, mentors, best friends, or boyfriend/girlfriend. These appear alongside regular family relationships on member profiles.",
          whereToFind: "Tree View > click a member > scroll to 'Special Connections' section > 'Add Connection' button.",
          icon: <Heart className="h-5 w-5 text-pink-500" />,
        },
        {
          name: "Relationship Calculator",
          description: "Select any two members in your tree and see how they're related. The calculator traces the connection path and shows the relationship label (e.g., second cousin, great-uncle).",
          whereToFind: "Tree View > menu > 'Relationship Calculator'. Select two people to see the result.",
          icon: <Zap className="h-5 w-5 text-yellow-500" />,
        },
      ],
    },
    {
      title: "Sharing & Collaboration",
      icon: <Share2 className="h-5 w-5" />,
      features: [
        {
          name: "Invite Members",
          description: "Share your tree with others by sending invite links. Set their role (Viewer, Editor, Co-owner) to control what they can do.",
          whereToFind: "Tree View > 'Share' button > generate an invite link or enter an email address.",
          icon: <Mail className="h-5 w-5 text-blue-600" />,
        },
        {
          name: "Role-Based Access",
          description: "Viewers can see the tree. Editors can add/edit members and relationships. Co-owners can manage settings, tags, and invite others. Owners have full control.",
          whereToFind: "Automatically applied when you invite someone. Change roles in Tree View > Settings > Members & Roles.",
          icon: <Shield className="h-5 w-5 text-amber-600" />,
        },
        {
          name: "QR Code Sharing",
          description: "Generate QR codes for your profile, tree invitations, or app links. Perfect for printing on reunion materials, church bulletins, or team rosters.",
          whereToFind: "Dashboard > 'My QR' in the menu. Also available in Tree View > Share > QR Code tab.",
          icon: <QrCode className="h-5 w-5 text-gray-700" />,
        },
        {
          name: "Connection Invite Links",
          description: "Generate a shareable link from inside any tree that lets others request to connect. The recipient sees your tree name and owner, and just picks their role or relationship — no extra setup needed. The link adapts to your tree type, showing the right options for family, sports, church, or any other group.",
          whereToFind: "Tree View > Menu (three lines) > 'Copy Connection Invite Link'. Share the link via text, email, or social media.",
          icon: <UserCheck className="h-5 w-5 text-teal-600" />,
        },
        {
          name: "Discoverable Community Trees",
          description: "Opt in to make your tree discoverable so others can find and request to join your community group. Only community trees (church, sports, etc.) can be made discoverable.",
          whereToFind: "Tree View > Settings > toggle 'Make Discoverable'. Browse others at Dashboard > 'Discover' in the menu.",
          icon: <Globe className="h-5 w-5 text-green-600" />,
        },
        {
          name: "Potential Family Connections",
          description: "When two trees are connected, the system automatically detects members who might be the same person across both trees using name, birth year, birth place, and gender matching. Matches appear on your Dashboard with confidence scores. If you own both trees, clicking Connect opens a merge dialog to resolve field conflicts and sync both profiles.",
          whereToFind: "Dashboard > 'Potential Family Connections' card (appears automatically when matches are found between your connected trees).",
          icon: <Sparkles className="h-5 w-5 text-primary" />,
        },
        {
          name: "Cross-Tree Profile Sync",
          description: "When the same person exists in two different trees, merging syncs the resolved data to both profiles without deleting either one. Both members stay in their trees to preserve relationships, and the merged view consolidates them into one person. Linked data like life events, education, and career records are copied to the primary profile.",
          whereToFind: "Triggered automatically when approving a claim for someone who already has a profile in another tree, or after connecting a Potential Family Connection match.",
          icon: <GitMerge className="h-5 w-5 text-blue-600" />,
        },
      ],
    },
    {
      title: "Privacy & Security",
      icon: <Lock className="h-5 w-5" />,
      features: [
        {
          name: "Three-Tier Visibility",
          description: "Control how much information is visible: Full Access (all details), Extended (name, year, photo only), or Limited (name and relationship only). Set at the tree level or override per member.",
          whereToFind: "Tree View > Settings > Privacy section. Per-member overrides available when editing a member.",
          icon: <Eye className="h-5 w-5 text-blue-600" />,
        },
        {
          name: "Deadman Switch",
          description: "Designate someone to inherit management of your trees if you become inactive for a set period. Ensures your family history is preserved.",
          whereToFind: "Dashboard > Account Settings > Deadman Switch section.",
          icon: <Shield className="h-5 w-5 text-red-600" />,
        },
        {
          name: "Muting Members/Branches",
          description: "Mute specific members or entire branches to hide them from your view without deleting them. Useful for managing complex family situations.",
          whereToFind: "Tree View > click a member > 'Mute' button in their profile panel.",
          icon: <Bell className="h-5 w-5 text-gray-500" />,
        },
      ],
    },
    {
      title: "AI & Research Tools",
      icon: <Sparkles className="h-5 w-5" />,
      features: [
        {
          name: "AI Chat Assistant",
          description: "Get help with genealogy questions, tree organization advice, or platform guidance from our AI assistant powered by GPT-4.1-mini.",
          whereToFind: "Click the 'Help' floating button at the bottom of any page.",
          icon: <Bot className="h-5 w-5 text-violet-600" />,
        },
        {
          name: "AI Avatar Videos",
          description: "Generate personalized AI avatar videos using HeyGen technology. Create video introductions, family stories, or tree presentations.",
          whereToFind: "Dashboard > menu > 'Videos' or use the Video button when available on tree pages.",
          icon: <Video className="h-5 w-5 text-red-500" />,
        },
        {
          name: "FamilySearch Integration",
          description: "Search FamilySearch's 66 billion+ historical records and import ancestors directly into your tree. Search individual records or import entire family branches with all relationships intact — up to 4 generations of ancestors (great-great-grandparents).",
          whereToFind: "Dashboard > 'Records' in the menu, or navigate to the FamilySearch page directly.",
          icon: <Search className="h-5 w-5 text-green-700" />,
        },
        {
          name: "Selective Member Import",
          description: "When importing from FamilySearch or a connected tree, browse all available members and hand-pick exactly who to bring in using checkboxes. Each person shows their name, photo, and relationship badges. A real-time ghost preview appears on the tree as you select members, showing exactly where they'll be placed before you commit.",
          whereToFind: "FamilySearch page > 'Import Tree' tab > check people > 'Import Selected'. For connected trees: Tree View > Connections > 'Import Members' on any connection.",
          icon: <Users className="h-5 w-5 text-teal-600" />,
        },
        {
          name: "Smart Conflict Detection",
          description: "When importing from FamilySearch, the system automatically compares imported people against your existing tree using fuzzy matching (name, birth year within 5 years, birth place, gender). Potential duplicates are shown side-by-side with differences highlighted so you can decide what to do.",
          whereToFind: "Happens automatically during FamilySearch tree import. After import, you'll see the conflict resolution screen.",
          icon: <Eye className="h-5 w-5 text-amber-600" />,
        },
        {
          name: "Smart Merge Sync",
          description: "When merging two people during import, FamilyRoots does a true sync — keeping the most complete data from both sides. All linked records transfer automatically: life events, education, career history, name changes, tags, FamilySearch sources, external identifiers, voice notes, gift registries, special connections, invitations, profile claims, custodianship records, mute preferences, and discoverable entries. Nothing is ever lost.",
          whereToFind: "During FamilySearch import conflict resolution > choose 'Same Person (Merge)' for any duplicate.",
          icon: <GitMerge className="h-5 w-5 text-blue-600" />,
        },
        {
          name: "Import Integrity Verification",
          description: "After resolving all conflicts, an automatic integrity check verifies every relationship, traces ancestor chains from root to most distant generation, and confirms all linked data transferred successfully. A detailed summary shows merge/skip/keep counts, relationship totals, and chain verification status.",
          whereToFind: "Shown automatically after completing conflict resolution during FamilySearch import.",
          icon: <FileCheck className="h-5 w-5 text-emerald-600" />,
        },
      ],
    },
    {
      title: "Merchandise & Gifts",
      icon: <ShoppingBag className="h-5 w-5" />,
      features: [
        {
          name: "Custom Merchandise",
          description: "Order custom print-on-demand items featuring your tree - prints, mugs, shirts, and more. Powered by Printful with extensive customization including QR codes and custom text.",
          whereToFind: "Dashboard > 'Merchandise' in the menu. Customize items with your tree data and order directly.",
          icon: <ShoppingBag className="h-5 w-5 text-orange-600" />,
        },
        {
          name: "Gift Registry",
          description: "Create and manage gift registries for birthdays, weddings, baby showers, graduations, holidays, and more. Add items from any online store with links and prices. Family members can mark items as purchased to prevent duplicates. Each registry shows fulfillment progress with a progress bar.",
          whereToFind: "Create from any member's profile panel > 'Gift Registries' section. Browse all tree registries from the 'Registries' tab in tree view. Also accessible via Dashboard > 'Gifts'.",
          icon: <Gift className="h-5 w-5 text-pink-600" />,
        },
      ],
    },
    {
      title: "Networking & Discovery",
      icon: <Network className="h-5 w-5" />,
      features: [
        {
          name: "Network Overview",
          description: "Visualize all your connections across multiple trees in one unified view. See how different communities and families overlap and connect.",
          whereToFind: "Dashboard > 'Network Overview' in the menu.",
          icon: <Network className="h-5 w-5 text-indigo-600" />,
        },
        {
          name: "Membership Badge",
          description: "View your personalized membership badge showing your stats, trees you belong to, and your activity. Share it with others as a digital card.",
          whereToFind: "Dashboard > 'My Badge' in the menu.",
          icon: <Award className="h-5 w-5 text-yellow-600" />,
        },
        {
          name: "Referral System",
          description: "Invite friends to FamilyRoots with your unique referral code. Track who you've referred and earn recognition.",
          whereToFind: "Dashboard > Account Settings > Referral section.",
          icon: <Zap className="h-5 w-5 text-yellow-500" />,
        },
        {
          name: "Location Sharing",
          description: "Optionally share your location to see family members or group members on a map. Great for planning reunions or seeing where your network spans.",
          whereToFind: "Dashboard > Account Settings > Location section. Map views available in Tree View.",
          icon: <MapPin className="h-5 w-5 text-red-500" />,
        },
        {
          name: "Public Profiles",
          description: "Share a public-facing profile page that shows your trees and basic information. Others can view it without needing an account.",
          whereToFind: "Dashboard > 'My Profile' in the menu. Share the link with anyone.",
          icon: <User className="h-5 w-5 text-blue-500" />,
        },
      ],
    },
    {
      title: "Tree Types at a Glance",
      icon: <BookOpen className="h-5 w-5" />,
      features: [
        {
          name: "Family Tree",
          description: "Traditional family tree with Parent, Child, Spouse, and Sibling relationships. Classic hierarchical layout centered on a main person.",
          whereToFind: "Dashboard > Create New Tree > select 'Family'.",
          icon: <Heart className="h-5 w-5 text-rose-500" />,
        },
        {
          name: "Church / Faith Group",
          description: "Organize congregations with roles like Pastor, Elder, Deacon, and Member. Warm color scheme with community-focused layout.",
          whereToFind: "Dashboard > Create New Tree > select 'Church'.",
          icon: <Church className="h-5 w-5 text-amber-600" />,
        },
        {
          name: "Sports Team",
          description: "Manage rosters with Coach, Captain, Player, and Staff roles. Bold accent colors and team-oriented visual hierarchy.",
          whereToFind: "Dashboard > Create New Tree > select 'Sports Team'.",
          icon: <Trophy className="h-5 w-5 text-yellow-500" />,
        },
        {
          name: "Fraternity / Sorority",
          description: "Track Greek life organizations with roles like President, Rush Chair, Pledge, and Alumni. Chapter-focused organization.",
          whereToFind: "Dashboard > Create New Tree > select 'Fraternity'.",
          icon: <GraduationCap className="h-5 w-5 text-purple-600" />,
        },
        {
          name: "Professional Network",
          description: "Map professional connections with roles like Mentor, Colleague, Manager, and Report. Business-oriented styling.",
          whereToFind: "Dashboard > Create New Tree > select 'Professional'.",
          icon: <Briefcase className="h-5 w-5 text-gray-600" />,
        },
        {
          name: "Friends Circle",
          description: "Casual group tree for friend networks with flexible, informal relationship types.",
          whereToFind: "Dashboard > Create New Tree > select 'Friends'.",
          icon: <Users className="h-5 w-5 text-sky-500" />,
        },
        {
          name: "School",
          description: "Organize academic communities with roles like Teacher, Student, Principal, Dean, Counselor, Classmate, and Club Advisor. Tags for class year, honor roll, and faculty status.",
          whereToFind: "Dashboard > Create New Tree > select 'School'.",
          icon: <GraduationCap className="h-5 w-5 text-indigo-600" />,
        },
        {
          name: "Custom Tree",
          description: "Build your own tree type with completely custom relationship labels and terminology. Fully flexible for any group structure you can imagine.",
          whereToFind: "Dashboard > Create New Tree > select 'Custom'.",
          icon: <Sparkles className="h-5 w-5 text-violet-500" />,
        },
      ],
    },
    {
      title: "Premium Content",
      icon: <Crown className="h-5 w-5" />,
      features: [
        {
          name: "Memory Lane",
          description: "A story feed attached to each tree where members can share memories, milestones, traditions, funny moments, and life lessons. Each memory can include a title, story text, category, optional photo, and date. Memories are displayed as a scrollable timeline that the whole tree can enjoy.",
          whereToFind: "Tree View > 'Memories' tab. Add new memories with the 'Add Memory' button at the top of the feed.",
          icon: <BookHeart className="h-5 w-5 text-rose-500" />,
        },
        {
          name: "Voice Notes",
          description: "Record and attach audio voice notes to individual member profiles. Capture oral histories, personal messages, birthday wishes, or any audio keepsake directly within the app. Notes are saved and playable from the member's profile panel.",
          whereToFind: "Tree View > click a member > scroll to 'Voice Notes' section in the profile panel. Use the record button to capture audio.",
          icon: <Mic className="h-5 w-5 text-blue-500" />,
        },
        {
          name: "Annual Tree Report",
          description: "A yearly statistical summary of your tree including total members, new additions, relationship breakdowns, and growth trends. View reports for the current year or browse past years to see how your tree has evolved over time.",
          whereToFind: "Tree View > 'Report' tab. Select a year from the dropdown to view historical reports.",
          icon: <BarChart3 className="h-5 w-5 text-emerald-600" />,
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Features Guide | FamilyRoots"
        description="A complete glossary of all FamilyRoots features and where to find them."
      />

      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm" className="gap-2" data-testid="button-back-home">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <TreeDeciduous className="h-5 w-5 text-primary" />
              <span className="font-serif font-bold text-lg">FamilyRoots</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8" data-testid="features-guide-page">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <BookOpen className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold font-serif" data-testid="features-guide-title">Features Guide</h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Everything FamilyRoots can do, explained in plain language with directions on where to find each feature.
          </p>
        </div>

        <div className="mb-6 p-4 rounded-lg border border-primary/20 bg-primary/5">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">Tip:</span> Use this page as a reference whenever you're looking for a specific feature.
            Each entry includes a description and step-by-step directions to find it in the app.
          </p>
        </div>

        <div className="space-y-8">
          {categories.map((category, catIdx) => (
            <Card key={catIdx} data-testid={`feature-category-${catIdx}`}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-serif">
                  {category.icon}
                  {category.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {category.features.map((feature, featIdx) => (
                    <div
                      key={featIdx}
                      className="flex gap-4 p-4 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition-colors"
                      data-testid={`feature-entry-${catIdx}-${featIdx}`}
                    >
                      <div className="shrink-0 mt-0.5">{feature.icon}</div>
                      <div className="space-y-1.5">
                        <h3 className="font-semibold text-foreground" data-testid={`feature-name-${catIdx}-${featIdx}`}>{feature.name}</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                        <div className="flex items-start gap-2 mt-2 pt-2 border-t border-border/50">
                          <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
                          <p className="text-xs text-primary font-medium leading-relaxed" data-testid={`feature-location-${catIdx}-${featIdx}`}>
                            {feature.whereToFind}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap gap-3 justify-center">
          <Link href="/faq">
            <Button variant="outline" className="gap-2" data-testid="link-to-faq">
              <BookOpen className="h-4 w-4" />
              View FAQ
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button className="gap-2" data-testid="link-to-dashboard">
              <TreeDeciduous className="h-4 w-4" />
              Go to Dashboard
            </Button>
          </Link>
        </div>
      </main>

      <footer className="border-t border-border mt-16 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} FamilyRoots. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
