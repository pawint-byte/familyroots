import { ArrowRight, BookOpen, GitBranch, Shield, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { SEO } from "@/components/seo";
import { MarketingPageShell } from "@/components/marketing-page-shell";

const posts = [
  {
    icon: Shield,
    category: "Privacy",
    title: "Why private family networks matter",
    description: "A practical look at preserving family stories while keeping control in the hands of the people who share them.",
    href: "/faq",
  },
  {
    icon: GitBranch,
    category: "Getting started",
    title: "Build a family tree people help maintain",
    description: "Start with your closest connections, invite relatives, and turn a static chart into a living family space.",
    href: "/features",
  },
  {
    icon: Sparkles,
    category: "Product",
    title: "See what is new in FamilyRoots",
    description: "Follow recent improvements to tree building, collaboration, memories, reports, and connected groups.",
    href: "/whats-new",
  },
];

export default function Blog() {
  return (
    <MarketingPageShell title="Blog">
      <SEO
        title="FamilyRoots Blog - Family Stories, Privacy, and Connection"
        description="Ideas and practical guidance for building living family trees, preserving stories, and creating private networks."
      />
      <main>
        <section className="relative overflow-hidden border-b border-border">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10" />
          <div className="container relative mx-auto px-4 py-20 text-center md:py-24">
            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <BookOpen className="h-7 w-7 text-primary" />
            </div>
            <p className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-primary">FamilyRoots Journal</p>
            <h1 className="font-serif text-4xl font-bold md:text-5xl">Stories about staying connected</h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
              Thoughtful guidance for building living family trees, protecting shared history, and bringing your people together.
            </p>
          </div>
        </section>

        <section className="container mx-auto px-4 py-16">
          <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-3">
            {posts.map(({ icon: Icon, category, title, description, href }) => (
              <Card key={title} className="group flex h-full flex-col border-card-border transition-colors hover:border-primary/40">
                <CardContent className="flex h-full flex-col p-6">
                  <div className="mb-6 flex items-center justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <Badge variant="secondary">{category}</Badge>
                  </div>
                  <h2 className="font-serif text-2xl font-semibold">{title}</h2>
                  <p className="mt-3 flex-1 leading-relaxed text-muted-foreground">{description}</p>
                  <Link href={href} className="mt-6 inline-flex items-center gap-2 font-medium text-primary">
                    Read more
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </main>
    </MarketingPageShell>
  );
}