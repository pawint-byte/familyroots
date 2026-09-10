import type { ReactNode } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import {
  TreeDeciduous,
  ArrowLeft,
  CreditCard,
  Users,
  Shield,
  Sparkles,
  HelpCircle,
  Gift,
  User,
  Heart,
  Zap,
  Briefcase,
  BookOpen,
  Lock,
  EyeOff,
  Globe,
  UserCheck,
  Tag,
  Star,
  QrCode,
  Search,
  ShoppingBag,
  GitMerge,
  ArrowRight,
  BookHeart,
  BarChart3,
  type LucideIcon,
} from "lucide-react";
import { SEO } from "@/components/seo";
import {
  FAQ_DESCRIPTION,
  FAQ_HEADING,
  faqCategories,
  getFaqStructuredData,
  type FAQAnswerPart,
} from "@shared/faq";

const faqIcons: Record<string, LucideIcon> = {
  TreeDeciduous,
  Heart,
  Zap,
  Briefcase,
  CreditCard,
  Users,
  User,
  Sparkles,
  Shield,
  Tag,
  Gift,
  BookOpen,
  BookHeart,
  BarChart3,
};

const faqStructuredData = getFaqStructuredData();

function renderFaqAnswerPart(part: FAQAnswerPart, key: string): ReactNode {
  if (typeof part === "string") return part;

  if ("text" in part) {
    return (
      <Link
        key={key}
        href={part.href}
        className="text-primary hover:underline font-medium"
      >
        {part.text}
      </Link>
    );
  }

  const children = part.children.map((child, index) =>
    renderFaqAnswerPart(child, `${key}-${index}`),
  );

  switch (part.tag) {
    case "ul":
      return <ul key={key} className={part.className}>{children}</ul>;
    case "li":
      return <li key={key} className={part.className}>{children}</li>;
    case "strong":
      return <strong key={key} className={part.className}>{children}</strong>;
    case "p":
      return <p key={key} className={part.className}>{children}</p>;
    case "br":
      return <br key={key} className={part.className} />;
  }
}

export default function FAQ() {
  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="FAQ - FamilyRoots"
        description="Frequently asked questions about FamilyRoots family tree management. Learn about subscriptions, sharing, privacy, and features."
        structuredData={faqStructuredData}
      />

      <header className="sticky top-0 z-50 backdrop-blur-md bg-background/80 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/">
              <div className="flex items-center gap-2 cursor-pointer" data-testid="link-home">
                <TreeDeciduous className="h-8 w-8 text-primary" />
                <span className="text-xl font-bold">FamilyRoots</span>
              </div>
            </Link>
            <div className="flex items-center gap-2">
              <LanguageSwitcher />
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <Link href="/">
            <Button variant="ghost" className="gap-2 mb-4" data-testid="button-back-home">
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Button>
          </Link>

          <div className="flex items-center gap-3 mb-4">
            <HelpCircle className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">{FAQ_HEADING}</h1>
          </div>
          <p className="text-muted-foreground text-lg">
            {FAQ_DESCRIPTION}
          </p>
        </div>

        <div className="relative rounded-2xl bg-gradient-to-br from-card via-card to-primary/5 dark:from-card dark:via-card dark:to-primary/10 border-2 border-primary/30 p-6 md:p-8 shadow-lg overflow-hidden mb-8" data-testid="faq-privacy-callout">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-primary/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
          <div className="relative">
            <div className="flex items-start gap-4 mb-4">
              <div className="shrink-0 w-12 h-12 rounded-xl bg-primary/15 border-2 border-primary/30 flex items-center justify-center">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-3 flex-wrap mb-2">
                  <h3 className="font-serif text-xl md:text-2xl font-bold" data-testid="text-faq-privacy-title">Private by Default. Public Only If You Choose.</h3>
                </div>
                <p className="text-foreground/90 leading-relaxed" data-testid="text-faq-privacy-body">
                  Every tree you create is <strong className="text-primary">completely private and invitation-only</strong>.
                  No one — not other users, not search engines, not anyone — can see your tree unless you personally invite them.
                  Some users choose to make their trees discoverable for community connections, and that's great for them.
                  But it's never the default, and it's never required. <strong>Your tree, your rules.</strong>
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm pl-16">
              <div className="flex items-center gap-2">
                <Lock className="h-3.5 w-3.5 text-primary" />
                <span className="text-muted-foreground">Private by default</span>
              </div>
              <div className="flex items-center gap-2">
                <UserCheck className="h-3.5 w-3.5 text-primary" />
                <span className="text-muted-foreground">Invite-only access</span>
              </div>
              <div className="flex items-center gap-2">
                <EyeOff className="h-3.5 w-3.5 text-primary" />
                <span className="text-muted-foreground">Invisible to outsiders</span>
              </div>
              <div className="flex items-center gap-2">
                <Globe className="h-3.5 w-3.5 text-primary" />
                <span className="text-muted-foreground">Public is optional, never forced</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-8" data-testid="faq-best-of-section">
          <div className="flex items-center gap-2 mb-4">
            <Star className="h-5 w-5 text-yellow-500" />
            <h2 className="text-xl font-bold">What Makes FamilyRoots Different</h2>
          </div>
          <p className="text-muted-foreground text-sm mb-5">
            These are the features you won't find on any other platform. Click any card to jump to the full answer below.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { icon: <UserCheck className="h-5 w-5 text-green-600" />, title: "Profile Claiming", teaser: "Family members own and update their own profiles — the tree stays accurate without one person doing all the work.", categoryIdx: 2, itemIdx: 0 },
              { icon: <GitMerge className="h-5 w-5 text-blue-600" />, title: "Cross-Tree Connections", teaser: "Link separate family trees when they share members. See the full extended family across both sides.", categoryIdx: 2, itemIdx: 4 },
              { icon: <Shield className="h-5 w-5 text-red-600" />, title: "Deadman Switch", teaser: "Designate an heir so your trees are never lost if something happens to you. No other platform does this.", categoryIdx: 2, itemIdx: 3 },
              { icon: <QrCode className="h-5 w-5 text-gray-700" />, title: "QR Code Profiles", teaser: "Scan QR codes at reunions to instantly connect. Print them on name tags and invitations.", categoryIdx: 2, itemIdx: 5 },
              { icon: <Search className="h-5 w-5 text-green-700" />, title: "FamilySearch Integration", teaser: "Search 66B+ historical records and import ancestors with smart duplicate detection and true sync merge.", categoryIdx: 8, itemIdx: 0 },
              { icon: <ShoppingBag className="h-5 w-5 text-orange-600" />, title: "Custom Merchandise", teaser: "Print your actual tree on mugs, shirts, posters, and blankets. Add QR codes, custom text, and photos.", categoryIdx: 2, itemIdx: 8 },
            ].map((item, i) => (
              <button
                key={i}
                className="text-left p-4 rounded-lg border border-border bg-card hover:border-primary/40 hover:shadow-sm transition-all group cursor-pointer"
                onClick={() => {
                  const el = document.querySelector(`[data-testid="faq-item-${item.categoryIdx}-${item.itemIdx}"]`);
                  if (el) {
                    el.scrollIntoView({ behavior: "smooth", block: "center" });
                    const trigger = el.querySelector("button");
                    if (trigger && el.getAttribute("data-state") !== "open") {
                      trigger.click();
                    }
                  }
                }}
                data-testid={`faq-best-of-card-${i}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  {item.icon}
                  <span className="font-semibold text-sm group-hover:text-primary transition-colors">{item.title}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.teaser}</p>
              </button>
            ))}
          </div>
          <div className="mt-4 text-center">
            <Link href="/features">
              <Button variant="outline" size="sm" className="gap-2" data-testid="faq-link-features-guide">
                See All Features
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>

        <div className="space-y-6">
          {faqCategories.map((category, categoryIndex) => {
            const CategoryIcon = faqIcons[category.icon];

            return (
              <Card key={categoryIndex} data-testid={`faq-category-${categoryIndex}`}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {CategoryIcon && <CategoryIcon className="h-5 w-5" />}
                    {category.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Accordion type="single" collapsible className="w-full">
                    {category.items.map((item, itemIndex) => (
                      <AccordionItem
                        key={itemIndex}
                        value={`item-${categoryIndex}-${itemIndex}`}
                        data-testid={`faq-item-${categoryIndex}-${itemIndex}`}
                      >
                        <AccordionTrigger className="text-left">
                          {item.question}
                        </AccordionTrigger>
                        <AccordionContent className="text-muted-foreground leading-relaxed">
                          {item.answer.map((part, partIndex) =>
                            renderFaqAnswerPart(
                              part,
                              `${categoryIndex}-${itemIndex}-${partIndex}`,
                            ),
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="mt-8 bg-primary/5 border-primary/20">
          <CardContent className="py-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">Still have questions?</h3>
              <p className="text-muted-foreground mb-4">
                Our AI assistant is available 24/7 to help you with any questions about FamilyRoots or genealogy research.
              </p>
              <p className="text-sm text-muted-foreground mb-3">
                Look for the <span className="font-medium text-primary">Help</span> button at the bottom of any page.
              </p>
              <a href="/features" className="text-sm text-primary font-medium hover:underline" data-testid="link-features-guide">
                View the full Features Guide
              </a>
            </div>
          </CardContent>
        </Card>
      </main>

      <footer className="border-t border-border mt-16 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} FamilyRoots. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}