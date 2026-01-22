import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import { SEO, defaultStructuredData } from "@/components/seo";
import { useI18n } from "@/lib/i18n";
import { Trees, Users, Share2, Shield, Calendar, ArrowRight, Sparkles, GitBranch, Link, Quote, Home } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function Landing() {
  const { t } = useI18n();
  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="FamilyRoots - Build Your Family's Living Legacy"
        description="Create beautiful, interactive family trees that connect generations. Start your household's tree and watch as relatives across the country connect their branches automatically."
        keywords="family tree, genealogy, ancestry, family history, interactive family tree, family members, heritage, household, family connections"
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
            <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-how-it-works">{t.nav.howItWorks}</a>
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-features">{t.nav.features}</a>
            <a href="#testimonials" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-testimonials">{t.nav.testimonials}</a>
            <a href="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-pricing">{t.nav.pricing}</a>
            <a href="/gifts" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-gifts">{t.nav.gifts}</a>
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
                  <a href="#how-it-works">
                    <Button size="lg" variant="outline" data-testid="button-hero-how">
                      {t.landing.watchDemo}
                    </Button>
                  </a>
                </div>
                <div className="flex items-center gap-6 text-sm text-muted-foreground">
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
                        <span className="text-primary font-medium">3 {t.landing.heroVisualHouseholds}</span> {t.landing.heroVisualConnected}
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
