import { Heart, Lock, Share2, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { SEO } from "@/components/seo";
import { MarketingPageShell } from "@/components/marketing-page-shell";

const values = [
  {
    icon: Lock,
    title: "Private by default",
    description: "Your family and community stories belong to the people who share them, not to the public internet.",
  },
  {
    icon: Users,
    title: "Built for living connections",
    description: "FamilyRoots helps real people collaborate, claim their profiles, and keep meaningful relationships current.",
  },
  {
    icon: Share2,
    title: "Stronger together",
    description: "Separate trees and groups can connect without giving up their identity, ownership, or privacy.",
  },
];

export default function About() {
  return (
    <MarketingPageShell title="About">
      <SEO
        title="About FamilyRoots - Private Networks for Real Connections"
        description="Learn why FamilyRoots is building a private, collaborative home for living family stories and meaningful communities."
      />
      <main>
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10" />
          <div className="container relative mx-auto px-4 py-20 text-center md:py-28">
            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <Heart className="h-7 w-7 text-primary" />
            </div>
            <p className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-primary">Our story</p>
            <h1 className="mx-auto max-w-3xl font-serif text-4xl font-bold leading-tight md:text-6xl">
              Keep the people who matter close
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              FamilyRoots was created to make family trees feel alive: private spaces where relatives and trusted communities can build, remember, and connect together.
            </p>
          </div>
        </section>

        <section className="container mx-auto px-4 py-16">
          <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-3">
            {values.map(({ icon: Icon, title, description }) => (
              <Card key={title} className="border-card-border">
                <CardContent className="p-6">
                  <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <h2 className="mb-2 font-serif text-xl font-semibold">{title}</h2>
                  <p className="leading-relaxed text-muted-foreground">{description}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mx-auto mt-16 max-w-3xl rounded-2xl border border-border bg-card/50 p-8 md:p-10">
            <h2 className="font-serif text-3xl font-bold">More than a genealogy database</h2>
            <div className="mt-5 space-y-4 leading-relaxed text-muted-foreground">
              <p>
                Traditional genealogy tools are excellent for researching the past. FamilyRoots complements that work by focusing on the relationships, memories, milestones, and communities that are active today.
              </p>
              <p>
                From family households to churches, teams, schools, and professional groups, every network stays invitation-only and organized around meaningful, labeled connections.
              </p>
            </div>
          </div>
        </section>
      </main>
    </MarketingPageShell>
  );
}