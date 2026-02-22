import { useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import { SEO, defaultStructuredData } from "@/components/seo";
import { useI18n } from "@/lib/i18n";
import { Trees, Users, Share2, Shield, Calendar, ArrowRight, Sparkles, GitBranch, Link, Quote, Home, Shirt, QrCode, Smartphone, Church, Trophy, GraduationCap, Heart, Briefcase, Lock, Eye, EyeOff, Globe, UserCheck } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DemoFamilyTree } from "@/components/demo-family-tree";
import { QRCodeSVG } from "qrcode.react";
import { apiRequest } from "@/lib/queryClient";

export default function Landing() {
  const [, navigate] = useLocation();
  const { t } = useI18n();

  // Capture referral code from URL and store in localStorage
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const refCode = params.get("ref");
    if (refCode) {
      localStorage.setItem("referralCode", refCode);
      // Track the click
      apiRequest("POST", `/api/referrals/click/${refCode}`).catch(() => {});
    }
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="FamilyRoots - Your Private Network for Real Connections"
        description="Build private, members-only networks where every connection means something. Family trees, church groups, sports teams, Greek life chapters, and professional networks - all in one secure, invitation-only platform."
        keywords="private network, members only, family tree, church group, sports team, fraternity, sorority, professional network, private connections, invitation only, genealogy"
        ogType="website"
        structuredData={defaultStructuredData}
      />
      <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-background/80 border-b border-border">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Trees className="h-7 w-7 text-primary" />
            <span className="font-serif text-xl font-semibold">FamilyRoots</span>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <a href="#why-private" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-why-private">Why Private</a>
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-features">{t.nav.features}</a>
            <a href="#testimonials" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-testimonials">{t.nav.testimonials}</a>
            <a href="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-pricing">{t.nav.pricing}</a>
            <a href="/gifts" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-gifts">{t.nav.gifts}</a>
            <a href="/faq" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-faq">FAQ</a>
            <a href="/features" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-features-guide">Features Guide</a>
            <a href="/comparison" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-comparison">Compare</a>
          </nav>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeToggle />
            <a href="/api/login">
              <Button variant="ghost" data-testid="button-login">{t.nav.login}</Button>
            </a>
            <a href="/api/login">
              <Button data-testid="button-get-started">{t.nav.getStarted}</Button>
            </a>
          </div>
        </div>
      </header>

      <main className="pt-16">
        {/* Hero Section */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/10" />
          <div className="container mx-auto px-4 py-24 md:py-32 relative">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="space-y-8">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                  <Sparkles className="h-4 w-4" />
                  <span>{t.landing.heroTagline}</span>
                </div>
                <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
                  {t.landing.heroTitle} <span className="text-primary">{t.landing.heroTitleHighlight}</span>
                </h1>
                <p className="text-lg md:text-xl text-muted-foreground max-w-xl">
                  {t.landing.heroDescription}
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <a href="/api/login">
                    <Button size="lg" className="gap-2" data-testid="button-hero-start">
                      {t.landing.startTree}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </a>
                  <a href="#why-private">
                    <Button size="lg" variant="outline" data-testid="button-hero-how">
                      Why Private Networks?
                    </Button>
                  </a>
                </div>
                <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-primary" />
                    <span>Invitation Only</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    <span>Members-Only Access</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <span>{t.landing.freePlan}</span>
                  </div>
                </div>
              </div>
              <div className="relative">
                {/* Visual: Multiple trees connecting */}
                <div className="relative bg-gradient-to-br from-card to-card/50 rounded-2xl border border-card-border p-8 shadow-xl" data-testid="hero-visual">
                  <div className="absolute -top-4 -right-4 w-24 h-24 bg-primary/20 rounded-full blur-2xl" />
                  <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-accent/30 rounded-full blur-2xl" />
                  <div className="relative">
                    {/* Three household trees connecting */}
                    <div className="flex justify-between items-start mb-6">
                      {/* Household 1 */}
                      <div className="text-center">
                        <div className="w-12 h-12 rounded-lg bg-primary/20 border-2 border-primary flex items-center justify-center mx-auto mb-2">
                          <Home className="h-6 w-6 text-primary" />
                        </div>
                        <div className="space-y-1">
                          <div className="w-8 h-8 rounded-full bg-card border-2 border-card-border flex items-center justify-center mx-auto">
                            <span className="text-xs font-serif">{t.landing.heroVisualYou}</span>
                          </div>
                          <div className="flex justify-center gap-1">
                            <div className="w-6 h-6 rounded-full bg-card border border-card-border" />
                            <div className="w-6 h-6 rounded-full bg-card border border-card-border" />
                          </div>
                        </div>
                      </div>
                      
                      {/* Connection Lines */}
                      <div className="flex-1 flex items-center justify-center">
                        <div className="flex items-center gap-1 text-primary">
                          <div className="w-8 h-0.5 bg-primary/50" />
                          <Link className="h-5 w-5" />
                          <div className="w-8 h-0.5 bg-primary/50" />
                        </div>
                      </div>
                      
                      {/* Household 2 */}
                      <div className="text-center">
                        <div className="w-12 h-12 rounded-lg bg-accent/20 border-2 border-accent flex items-center justify-center mx-auto mb-2">
                          <Home className="h-6 w-6 text-accent-foreground" />
                        </div>
                        <div className="space-y-1">
                          <div className="w-8 h-8 rounded-full bg-card border-2 border-card-border flex items-center justify-center mx-auto">
                            <span className="text-xs font-serif">{t.landing.heroVisualSis}</span>
                          </div>
                          <div className="flex justify-center gap-1">
                            <div className="w-6 h-6 rounded-full bg-card border border-card-border" />
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Connection to third household below */}
                    <div className="flex justify-center mb-4">
                      <div className="flex flex-col items-center text-primary">
                        <div className="h-6 w-0.5 bg-primary/50" />
                        <Link className="h-4 w-4" />
                        <div className="h-6 w-0.5 bg-primary/50" />
                      </div>
                    </div>
                    
                    {/* Household 3 - Cousins */}
                    <div className="text-center">
                      <div className="w-12 h-12 rounded-lg bg-secondary/30 border-2 border-secondary flex items-center justify-center mx-auto mb-2">
                        <Home className="h-6 w-6 text-secondary-foreground" />
                      </div>
                      <div className="flex justify-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-card border-2 border-card-border flex items-center justify-center">
                          <span className="text-xs font-serif">{t.landing.heroVisualC1}</span>
                        </div>
                        <div className="w-7 h-7 rounded-full bg-card border-2 border-card-border flex items-center justify-center">
                          <span className="text-xs font-serif">{t.landing.heroVisualC2}</span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">{t.landing.heroVisualCousinsLocation}</p>
                    </div>
                    
                    {/* Caption */}
                    <div className="mt-6 pt-4 border-t border-border text-center">
                      <p className="text-sm text-muted-foreground">
                        <span className="text-primary font-medium">3 private groups</span> connected through you - visible only to members
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="py-24 bg-card/50">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="font-serif text-3xl md:text-4xl font-bold mb-4">{t.landing.howItWorksTitle}</h2>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                {t.landing.howItWorksSubtitle}
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {/* Step 1 */}
              <div className="text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <span className="text-2xl font-bold text-primary">1</span>
                </div>
                <div className="h-1 w-full bg-gradient-to-r from-transparent via-primary/30 to-transparent hidden md:block" />
                <h3 className="font-semibold text-xl">{t.landing.step1Title}</h3>
                <p className="text-muted-foreground">
                  {t.landing.step1Desc}
                </p>
                <div className="pt-4">
                  <Trees className="h-12 w-12 text-primary/60 mx-auto" />
                </div>
              </div>
              
              {/* Step 2 */}
              <div className="text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <span className="text-2xl font-bold text-primary">2</span>
                </div>
                <div className="h-1 w-full bg-gradient-to-r from-transparent via-primary/30 to-transparent hidden md:block" />
                <h3 className="font-semibold text-xl">{t.landing.step2Title}</h3>
                <p className="text-muted-foreground">
                  {t.landing.step2Desc}
                </p>
                <div className="pt-4">
                  <Share2 className="h-12 w-12 text-primary/60 mx-auto" />
                </div>
              </div>
              
              {/* Step 3 */}
              <div className="text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <span className="text-2xl font-bold text-primary">3</span>
                </div>
                <div className="h-1 w-full bg-gradient-to-r from-transparent via-primary/30 to-transparent hidden md:block" />
                <h3 className="font-semibold text-xl">{t.landing.step3Title}</h3>
                <p className="text-muted-foreground">
                  {t.landing.step3Desc}
                </p>
                <div className="pt-4">
                  <GitBranch className="h-12 w-12 text-primary/60 mx-auto" />
                </div>
              </div>
            </div>
            
            {/* CTA after steps */}
            <div className="text-center mt-12">
              <a href="/api/login">
                <Button size="lg" className="gap-2" data-testid="button-how-cta">
                  {t.landing.startTree}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </a>
            </div>
          </div>
        </section>

        {/* Why Private Networks Section */}
        <section id="why-private" className="py-24">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
                <Lock className="h-4 w-4" />
                <span>The Private Network Difference</span>
              </div>
              <h2 className="font-serif text-3xl md:text-4xl font-bold mb-4" data-testid="text-why-private-title">
                Not Another Social Network
              </h2>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto" data-testid="text-why-private-subtitle">
                On social media, "connections" are meaningless. Anyone can follow you, and nobody knows how you're actually related. FamilyRoots is different.
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
              <Card className="border-destructive/30" data-testid="card-public-network">
                <CardContent className="p-8 space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                      <Globe className="h-5 w-5 text-destructive" />
                    </div>
                    <h3 className="font-semibold text-lg">Public Social Networks</h3>
                  </div>
                  <div className="space-y-4">
                    {[
                      { icon: Eye, text: "Anyone can see who you're connected to" },
                      { icon: Users, text: "\"Friends\" and \"Followers\" with no real meaning" },
                      { icon: Globe, text: "Your connections are public by default" },
                      { icon: Share2, text: "No way to label how you actually know someone" },
                    ].map((item, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <div className="mt-0.5 w-6 h-6 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                          <item.icon className="h-3.5 w-3.5 text-destructive" />
                        </div>
                        <p className="text-sm text-muted-foreground">{item.text}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-primary" data-testid="card-private-network">
                <CardContent className="p-8 space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Shield className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="font-semibold text-lg">FamilyRoots Private Networks</h3>
                  </div>
                  <div className="space-y-4">
                    {[
                      { icon: Lock, text: "Only members you invite can see inside your group" },
                      { icon: UserCheck, text: "Every connection has a real label: parent, coach, pastor, mentor" },
                      { icon: EyeOff, text: "Three tiers of privacy: Full, Extended, Limited access" },
                      { icon: Shield, text: "You control exactly who sees what, with role-based permissions" },
                    ].map((item, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <div className="mt-0.5 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <item.icon className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <p className="text-sm text-muted-foreground">{item.text}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
            <div className="text-center mt-10">
              <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
                Your family knows you're their cousin. Your church knows you're their pastor. Your team knows you're the captain. But outsiders? They see nothing.
              </p>
              <a href="/api/login">
                <Button size="lg" className="gap-2" data-testid="button-private-cta">
                  Build Your Private Network
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </a>
            </div>
          </div>
        </section>

        {/* Privacy Promise Banner */}
        <section className="py-12 bg-primary/5 dark:bg-primary/10 border-y-2 border-primary/20" data-testid="section-privacy-promise">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <div className="relative rounded-2xl bg-gradient-to-br from-card via-card to-primary/5 dark:from-card dark:via-card dark:to-primary/10 border-2 border-primary/30 p-8 md:p-10 shadow-lg overflow-hidden">
                <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
                <div className="relative flex flex-col md:flex-row items-start md:items-center gap-6">
                  <div className="shrink-0">
                    <div className="w-16 h-16 rounded-2xl bg-primary/15 border-2 border-primary/30 flex items-center justify-center">
                      <Shield className="h-8 w-8 text-primary" />
                    </div>
                  </div>
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="font-serif text-2xl md:text-3xl font-bold" data-testid="text-privacy-promise-title">
                        Your Privacy, Your Choice
                      </h3>
                      <Badge className="bg-primary text-primary-foreground text-xs px-3 py-1">
                        <Lock className="h-3 w-3 mr-1" />
                        Private by Default
                      </Badge>
                    </div>
                    <p className="text-base md:text-lg text-foreground/90 leading-relaxed" data-testid="text-privacy-promise-body">
                      Every tree you create on FamilyRoots is <strong className="text-primary">completely private and invitation-only</strong> by default. 
                      No one can see your tree, your members, or your connections unless you personally invite them. 
                      Not other users, not search engines, not anyone.
                    </p>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Want to share more openly? You can optionally make a tree discoverable for community connections. 
                      But that's always your choice, never the default. You stay in full control of who sees what, with 
                      role-based permissions and three tiers of privacy for every member.
                    </p>
                  </div>
                </div>
                <div className="relative mt-6 pt-6 border-t border-primary/15">
                  <div className="flex flex-wrap items-center gap-x-8 gap-y-3 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center">
                        <Lock className="h-3 w-3 text-primary" />
                      </div>
                      <span className="text-muted-foreground">Private by default</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center">
                        <UserCheck className="h-3 w-3 text-primary" />
                      </div>
                      <span className="text-muted-foreground">Invite-only access</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center">
                        <EyeOff className="h-3 w-3 text-primary" />
                      </div>
                      <span className="text-muted-foreground">Invisible to outsiders</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center">
                        <Shield className="h-3 w-3 text-primary" />
                      </div>
                      <span className="text-muted-foreground">Role-based permissions</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Demo Family Tree Section */}
        <section id="demo-tree" className="py-24 bg-card/50">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="font-serif text-3xl md:text-4xl font-bold mb-4" data-testid="text-demo-tree-title">See Your Family Tree Come to Life</h2>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto" data-testid="text-demo-tree-subtitle">
                Build beautiful, interactive family trees spanning generations. From grandparents to grandchildren, every branch tells a story.
              </p>
            </div>
            <div className="max-w-3xl mx-auto">
              <Card className="overflow-visible" data-testid="card-demo-tree">
                <CardContent className="p-6 md:p-8">
                  <div className="mb-6 flex flex-wrap items-center justify-center gap-4 text-sm" data-testid="demo-tree-legend">
                    <div className="flex items-center gap-2" data-testid="legend-you">
                      <div className="w-3 h-3 rounded-full bg-primary" data-testid="legend-you-dot" />
                      <span className="text-muted-foreground" data-testid="legend-you-text">You (Focus)</span>
                    </div>
                    <div className="flex items-center gap-2" data-testid="legend-family">
                      <div className="w-3 h-3 rounded-full bg-muted border border-border" data-testid="legend-family-dot" />
                      <span className="text-muted-foreground" data-testid="legend-family-text">Family Members</span>
                    </div>
                    <div className="flex items-center gap-2" data-testid="legend-unknown">
                      <div className="w-3 h-3 rounded-full border-2 border-dashed border-muted-foreground/50" data-testid="legend-unknown-dot" />
                      <span className="text-muted-foreground" data-testid="legend-unknown-text">Unknown (Placeholder)</span>
                    </div>
                  </div>
                  <DemoFamilyTree />
                  <div className="mt-6 text-center text-sm text-muted-foreground" data-testid="text-demo-tree-caption">
                    <p data-testid="text-demo-tree-generations">4 generations: Grandparents, Parents, You & Siblings, and Your Children</p>
                  </div>
                </CardContent>
              </Card>
            </div>
            <div className="text-center mt-8">
              <a href="/api/login">
                <Button size="lg" className="gap-2" data-testid="button-demo-cta">
                  Start Building Your Tree
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </a>
            </div>
          </div>
        </section>

        {/* Beyond Family Trees Section */}
        <section id="tree-types" className="py-24 bg-card/50">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
                <Sparkles className="h-4 w-4" />
                <span>More than genealogy</span>
              </div>
              <h2 className="font-serif text-3xl md:text-4xl font-bold mb-4" data-testid="text-tree-types-title">
                One Platform, Every Private Circle
              </h2>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto" data-testid="text-tree-types-subtitle">
                Each group gets its own private space with roles that actually make sense. 
                Your church group doesn't need "friends" - they need "pastor" and "member." Build the network your group deserves.
              </p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {[
                { icon: Users, title: "Family Trees", desc: "Private family networks where only relatives see the full picture. Track blood, in-laws, and extended family across generations.", badge: "Flagship", highlight: true },
                { icon: Church, title: "Church & Faith", desc: "A members-only space for your congregation. Organize ministries, leadership, and mentorship - visible only to your flock.", badge: "New" },
                { icon: Trophy, title: "Sports Teams", desc: "Private team rosters with real roles - coach, captain, player. Keep your team's connections off public social media.", badge: "New" },
                { icon: GraduationCap, title: "Greek Life", desc: "Chapter networks with big/little pairs, pledge classes, and alumni - all behind closed doors where they belong.", badge: "New" },
                { icon: Heart, title: "Friend Circles", desc: "Map your real inner circle. Best friends, close friends, roommates - without broadcasting it to the world.", badge: "New" },
                { icon: Briefcase, title: "Professional", desc: "A private directory of your actual working relationships. Manager, mentor, colleague - not just LinkedIn connections.", badge: "New" },
              ].map((item, i) => (
                <Card key={i} className={`hover-elevate ${item.highlight ? "border-primary" : ""}`} data-testid={`card-tree-type-${i}`}>
                  <CardContent className="p-6 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <item.icon className="h-5 w-5 text-primary" />
                      </div>
                      <Badge variant={item.highlight ? "default" : "secondary"} className="text-xs">
                        {item.badge}
                      </Badge>
                    </div>
                    <h3 className="font-semibold text-lg">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="text-center mt-10">
              <p className="text-muted-foreground mb-4">
                You are the common anchor across all your private networks. 
                Each group has its own roles and relationships, all members-only, and all under your control.
              </p>
              <a href="/api/login">
                <Button size="lg" className="gap-2" data-testid="button-tree-types-cta">
                  Start Building
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </a>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-24">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="font-serif text-3xl md:text-4xl font-bold mb-4">{t.landing.featuresTitle}</h2>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                {t.landing.featuresSubtitle}
              </p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card className="hover-elevate group">
                <CardContent className="p-6 space-y-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <GitBranch className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg">{t.landing.feature1Title}</h3>
                  <p className="text-muted-foreground">
                    {t.landing.feature1Desc}
                  </p>
                </CardContent>
              </Card>
              <Card className="hover-elevate group">
                <CardContent className="p-6 space-y-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg">{t.landing.feature2Title}</h3>
                  <p className="text-muted-foreground">
                    {t.landing.feature2Desc}
                  </p>
                </CardContent>
              </Card>
              <Card className="hover-elevate group">
                <CardContent className="p-6 space-y-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Share2 className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg">{t.landing.feature3Title}</h3>
                  <p className="text-muted-foreground">
                    {t.landing.feature3Desc}
                  </p>
                </CardContent>
              </Card>
              <Card className="hover-elevate group">
                <CardContent className="p-6 space-y-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Shield className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg">{t.landing.feature4Title}</h3>
                  <p className="text-muted-foreground">
                    {t.landing.feature4Desc}
                  </p>
                </CardContent>
              </Card>
              <Card className="hover-elevate group">
                <CardContent className="p-6 space-y-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Calendar className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg">{t.landing.feature5Title}</h3>
                  <p className="text-muted-foreground">
                    {t.landing.feature5Desc}
                  </p>
                </CardContent>
              </Card>
              <Card className="hover-elevate group">
                <CardContent className="p-6 space-y-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Sparkles className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg">{t.landing.feature6Title}</h3>
                  <p className="text-muted-foreground">
                    {t.landing.feature6Desc}
                  </p>
                </CardContent>
              </Card>
              <Card 
                className="hover-elevate group cursor-pointer" 
                onClick={() => navigate("/merchandise")}
                data-testid="card-feature-merchandise"
              >
                <CardContent className="p-6 space-y-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Shirt className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg">Custom Merchandise</h3>
                  <p className="text-muted-foreground">
                    Turn your family tree into keepsakes. Order custom mugs, t-shirts, posters, and more with your tree printed on them - shipped directly to you.
                  </p>
                  <Button variant="outline" size="sm" className="mt-2" data-testid="button-shop-merchandise">
                    Shop Now
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Testimonials Section */}
        <section id="testimonials" className="py-24 bg-card/50">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="font-serif text-3xl md:text-4xl font-bold mb-4">{t.landing.testimonialsTitle}</h2>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                {t.landing.testimonialsSubtitle}
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
              {/* Testimonial 1 - Reunion Organizer */}
              <Card className="hover-elevate">
                <CardContent className="p-6 space-y-4">
                  <Quote className="h-8 w-8 text-primary/30" />
                  <p className="text-muted-foreground italic leading-relaxed">
                    "{t.landing.testimonial1Quote}"
                  </p>
                  <div className="flex items-center gap-4 pt-4 border-t border-border">
                    <Avatar>
                      <AvatarFallback className="bg-primary/10 text-primary">MR</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{t.landing.testimonial1Name}</p>
                      <p className="text-sm text-muted-foreground">{t.landing.testimonial1Role}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Testimonial 2 - Family Historian */}
              <Card className="hover-elevate">
                <CardContent className="p-6 space-y-4">
                  <Quote className="h-8 w-8 text-primary/30" />
                  <p className="text-muted-foreground italic leading-relaxed">
                    "{t.landing.testimonial2Quote}"
                  </p>
                  <div className="flex items-center gap-4 pt-4 border-t border-border">
                    <Avatar>
                      <AvatarFallback className="bg-primary/10 text-primary">JC</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{t.landing.testimonial2Name}</p>
                      <p className="text-sm text-muted-foreground">{t.landing.testimonial2Role}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Testimonial 3 - New Parent */}
              <Card className="hover-elevate">
                <CardContent className="p-6 space-y-4">
                  <Quote className="h-8 w-8 text-primary/30" />
                  <p className="text-muted-foreground italic leading-relaxed">
                    "{t.landing.testimonial3Quote}"
                  </p>
                  <div className="flex items-center gap-4 pt-4 border-t border-border">
                    <Avatar>
                      <AvatarFallback className="bg-primary/10 text-primary">SW</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{t.landing.testimonial3Name}</p>
                      <p className="text-sm text-muted-foreground">{t.landing.testimonial3Role}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Testimonial 4 - Blended Family */}
              <Card className="hover-elevate">
                <CardContent className="p-6 space-y-4">
                  <Quote className="h-8 w-8 text-primary/30" />
                  <p className="text-muted-foreground italic leading-relaxed">
                    "{t.landing.testimonial4Quote}"
                  </p>
                  <div className="flex items-center gap-4 pt-4 border-t border-border">
                    <Avatar>
                      <AvatarFallback className="bg-primary/10 text-primary">MD</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{t.landing.testimonial4Name}</p>
                      <p className="text-sm text-muted-foreground">{t.landing.testimonial4Role}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="py-24">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
                <Sparkles className="h-4 w-4" />
                <span>Simple, Fair Pricing</span>
              </div>
              <h2 className="font-serif text-3xl md:text-4xl font-bold mb-4">
                Grow Your Tree, Save More
              </h2>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                The bigger your family tree grows, the less you pay. Reach 100 members and it's completely free forever.
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4 max-w-6xl mx-auto" data-testid="pricing-cards-grid">
              {/* Free Tier */}
              <Card className="relative border-2 hover-elevate" data-testid="card-pricing-starter">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                    <Users className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold text-lg mb-1">Starter</h3>
                  <p className="text-sm text-muted-foreground mb-4">Up to 20 members</p>
                  <div className="text-3xl font-bold mb-2" data-testid="text-price-starter">Free</div>
                  <p className="text-xs text-muted-foreground">1 tree included</p>
                </CardContent>
              </Card>
              
              {/* Tier 25 */}
              <Card className="relative hover-elevate" data-testid="card-pricing-growing">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Trees className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg mb-1">Growing</h3>
                  <p className="text-sm text-muted-foreground mb-4">25-49 members</p>
                  <div className="text-3xl font-bold mb-1" data-testid="text-price-growing">$7.49</div>
                  <p className="text-sm text-muted-foreground">/month</p>
                  <Badge variant="secondary" className="mt-2">25% off</Badge>
                </CardContent>
              </Card>
              
              {/* Tier 50 */}
              <Card className="relative hover-elevate" data-testid="card-pricing-extended">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <GitBranch className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg mb-1">Extended</h3>
                  <p className="text-sm text-muted-foreground mb-4">50-74 members</p>
                  <div className="text-3xl font-bold mb-1" data-testid="text-price-extended">$4.99</div>
                  <p className="text-sm text-muted-foreground">/month</p>
                  <Badge variant="secondary" className="mt-2">50% off</Badge>
                </CardContent>
              </Card>
              
              {/* Tier 75 */}
              <Card className="relative hover-elevate" data-testid="card-pricing-reunion">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Share2 className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg mb-1">Reunion</h3>
                  <p className="text-sm text-muted-foreground mb-4">75-99 members</p>
                  <div className="text-3xl font-bold mb-1" data-testid="text-price-reunion">$2.50</div>
                  <p className="text-sm text-muted-foreground">/month</p>
                  <Badge variant="secondary" className="mt-2">75% off</Badge>
                </CardContent>
              </Card>
              
              {/* Heritage Tier (Free) */}
              <Card className="relative border-2 border-primary hover-elevate" data-testid="card-pricing-heritage">
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground">Best Value</Badge>
                </div>
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg mb-1">Heritage</h3>
                  <p className="text-sm text-muted-foreground mb-4">100+ members</p>
                  <div className="text-3xl font-bold text-primary mb-2" data-testid="text-price-heritage">Free</div>
                  <p className="text-xs text-muted-foreground">Forever free</p>
                </CardContent>
              </Card>
            </div>
            
            <div className="text-center mt-8 space-y-4">
              <p className="text-sm text-muted-foreground" data-testid="text-pricing-features">
                All plans include unlimited trees, cross-tree connections, and collaboration features.
              </p>
              <p className="text-sm font-medium" data-testid="text-annual-discount">
                <span className="bg-primary/10 text-foreground px-2 py-1 rounded">Save 20% with annual billing</span>
              </p>
              <a href="/pricing" data-testid="link-view-full-pricing">
                <Button variant="outline" data-testid="button-view-full-pricing">
                  View Full Pricing Details
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </a>
            </div>
          </div>
        </section>

        {/* Final CTA Section - Heads of Household */}
        <section className="py-24">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center space-y-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary font-medium">
                <Home className="h-5 w-5" />
                <span>{t.landing.headsOfHouseholdCta}</span>
              </div>
              <h2 className="font-serif text-3xl md:text-4xl font-bold">
                {t.landing.ctaTitle}
              </h2>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                {t.landing.ctaDescription}
              </p>
              <p className="text-muted-foreground">
                {t.landing.headsOfHouseholdDesc}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a href="/api/login">
                  <Button size="lg" className="gap-2" data-testid="button-cta-start">
                    {t.landing.ctaButton}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </a>
                <a href="/pricing">
                  <Button size="lg" variant="outline" data-testid="button-cta-pricing">
                    {t.nav.pricing}
                  </Button>
                </a>
              </div>
              <div className="flex items-center justify-center gap-8 pt-8 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  <span>{t.landing.gdprCompliant}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <span>{t.landing.freePlan}</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* QR Code Share Section */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <div className="grid md:grid-cols-2 gap-0">
                  <div className="p-8 flex flex-col justify-center">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium w-fit mb-4">
                      <Smartphone className="h-4 w-4" />
                      <span>Share Instantly</span>
                    </div>
                    <h3 className="font-serif text-2xl font-bold mb-3">
                      Share FamilyRoots With Your Family
                    </h3>
                    <p className="text-muted-foreground mb-6">
                      Scan this QR code with your phone camera to open the app, or share it with relatives to help them join your family tree.
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <a href="/share">
                        <Button variant="outline" className="gap-2" data-testid="button-view-share-page">
                          <QrCode className="h-4 w-4" />
                          Download QR Code
                        </Button>
                      </a>
                      <Button 
                        variant="ghost" 
                        className="gap-2"
                        onClick={() => {
                          navigator.clipboard.writeText(window.location.origin);
                        }}
                        data-testid="button-copy-app-link"
                      >
                        <Share2 className="h-4 w-4" />
                        Copy Link
                      </Button>
                    </div>
                  </div>
                  <div className="bg-white p-8 flex items-center justify-center">
                    <div className="text-center">
                      <QRCodeSVG
                        value={typeof window !== "undefined" ? window.location.origin : "https://familyroots.family"}
                        size={180}
                        level="H"
                        includeMargin
                        data-testid="qr-code-landing"
                      />
                      <p className="text-xs text-gray-500 mt-2">Scan to open FamilyRoots</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Trees className="h-5 w-5 text-primary" />
              <span className="font-serif text-sm">FamilyRoots</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {new Date().getFullYear()} FamilyRoots. All rights reserved.
            </p>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <a href="/faq" className="hover:text-foreground transition-colors">FAQ</a>
              <a href="/features" className="hover:text-foreground transition-colors">Features</a>
              <a href="/comparison" className="hover:text-foreground transition-colors">Compare</a>
              <a href="/share" className="hover:text-foreground transition-colors">Share</a>
              <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
              <a href="#" className="hover:text-foreground transition-colors">Terms</a>
              <a href="mailto:pawint@me.com" className="hover:text-foreground transition-colors">Contact</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
