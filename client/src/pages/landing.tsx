import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { Trees, Users, Share2, Shield, Search, Calendar, ArrowRight, Sparkles } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-background/80 border-b border-border">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Trees className="h-7 w-7 text-primary" />
            <span className="font-serif text-xl font-semibold">FamilyRoots</span>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-features">Features</a>
            <a href="#timeline" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-timeline">Timeline</a>
            <a href="#collaboration" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-collaboration">Collaboration</a>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <a href="/api/login">
              <Button variant="ghost" data-testid="button-login">Log In</Button>
            </a>
            <a href="/api/login">
              <Button data-testid="button-get-started">Get Started</Button>
            </a>
          </div>
        </div>
      </header>

      <main className="pt-16">
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/10" />
          <div className="container mx-auto px-4 py-24 md:py-32 relative">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="space-y-8">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                  <Sparkles className="h-4 w-4" />
                  <span>Discover Your Heritage</span>
                </div>
                <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
                  Build Your Family's <span className="text-primary">Living Legacy</span>
                </h1>
                <p className="text-lg md:text-xl text-muted-foreground max-w-xl">
                  Create beautiful, interactive family trees that connect generations. 
                  Preserve stories, share memories, and discover your roots together.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <a href="/api/login">
                    <Button size="lg" className="gap-2" data-testid="button-hero-start">
                      Start Your Tree
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </a>
                  <Button size="lg" variant="outline" data-testid="button-hero-demo">
                    Watch Demo
                  </Button>
                </div>
                <div className="flex items-center gap-6 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    <span>GDPR Compliant</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <span>Free Forever Plan</span>
                  </div>
                </div>
              </div>
              <div className="relative">
                <div className="relative bg-gradient-to-br from-card to-card/50 rounded-2xl border border-card-border p-8 shadow-xl">
                  <div className="absolute -top-4 -right-4 w-24 h-24 bg-primary/20 rounded-full blur-2xl" />
                  <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-accent/30 rounded-full blur-2xl" />
                  <div className="relative space-y-6">
                    <div className="flex justify-center">
                      <div className="w-20 h-20 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center">
                        <span className="font-serif text-2xl text-primary">GG</span>
                      </div>
                    </div>
                    <div className="h-8 border-l-2 border-dashed border-muted-foreground/30 mx-auto" />
                    <div className="flex justify-center gap-8">
                      <div className="w-16 h-16 rounded-full bg-card border-2 border-card-border flex items-center justify-center">
                        <span className="font-serif text-lg">GP</span>
                      </div>
                      <div className="w-16 h-16 rounded-full bg-card border-2 border-card-border flex items-center justify-center">
                        <span className="font-serif text-lg">GM</span>
                      </div>
                    </div>
                    <div className="h-8 border-l-2 border-dashed border-muted-foreground/30 mx-auto" />
                    <div className="flex justify-center gap-4">
                      <div className="w-14 h-14 rounded-full bg-card border-2 border-card-border flex items-center justify-center">
                        <span className="font-serif">D</span>
                      </div>
                      <div className="w-14 h-14 rounded-full bg-card border-2 border-card-border flex items-center justify-center">
                        <span className="font-serif">M</span>
                      </div>
                      <div className="w-14 h-14 rounded-full bg-card border-2 border-card-border flex items-center justify-center">
                        <span className="font-serif">U</span>
                      </div>
                    </div>
                    <div className="h-8 border-l-2 border-dashed border-muted-foreground/30 mx-auto" />
                    <div className="flex justify-center gap-6">
                      <div className="w-12 h-12 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center">
                        <span className="font-serif text-sm text-primary">You</span>
                      </div>
                      <div className="w-12 h-12 rounded-full bg-card border-2 border-card-border flex items-center justify-center">
                        <span className="font-serif text-sm">S</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="py-24 bg-card/50">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="font-serif text-3xl md:text-4xl font-bold mb-4">Everything You Need</h2>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                Powerful features to help you build, explore, and share your family history
              </p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card className="hover-elevate group">
                <CardContent className="p-6 space-y-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Trees className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg">Interactive Trees</h3>
                  <p className="text-muted-foreground">
                    Build dynamic family trees with drag-and-drop simplicity. Zoom, pan, and explore generations seamlessly.
                  </p>
                </CardContent>
              </Card>
              <Card className="hover-elevate group">
                <CardContent className="p-6 space-y-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg">Rich Profiles</h3>
                  <p className="text-muted-foreground">
                    Add photos, stories, birth dates, locations, and detailed notes for each family member.
                  </p>
                </CardContent>
              </Card>
              <Card className="hover-elevate group">
                <CardContent className="p-6 space-y-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Share2 className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg">Collaborate</h3>
                  <p className="text-muted-foreground">
                    Invite family members to contribute. Control who can view and edit your tree.
                  </p>
                </CardContent>
              </Card>
              <Card className="hover-elevate group">
                <CardContent className="p-6 space-y-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Search className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg">Smart Search</h3>
                  <p className="text-muted-foreground">
                    Find any family member instantly by name, date, or location across your entire tree.
                  </p>
                </CardContent>
              </Card>
              <Card className="hover-elevate group">
                <CardContent className="p-6 space-y-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Calendar className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg">Timeline View</h3>
                  <p className="text-muted-foreground">
                    See your family history unfold chronologically with events, milestones, and memories.
                  </p>
                </CardContent>
              </Card>
              <Card className="hover-elevate group">
                <CardContent className="p-6 space-y-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Shield className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg">Privacy First</h3>
                  <p className="text-muted-foreground">
                    Your data is encrypted and secure. Full control over who sees your family information.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="py-24">
          <div className="container mx-auto px-4 text-center">
            <h2 className="font-serif text-3xl md:text-4xl font-bold mb-4">
              Start Building Your Family Tree Today
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-8">
              Join thousands of families preserving their heritage. Free forever, no credit card required.
            </p>
            <a href="/api/login">
              <Button size="lg" className="gap-2" data-testid="button-cta-start">
                Create Your Free Account
                <ArrowRight className="h-4 w-4" />
              </Button>
            </a>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Trees className="h-5 w-5 text-primary" />
              <span className="font-serif text-sm">FamilyRoots</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} FamilyRoots. All rights reserved.
            </p>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
              <a href="#" className="hover:text-foreground transition-colors">Terms</a>
              <a href="#" className="hover:text-foreground transition-colors">Contact</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
