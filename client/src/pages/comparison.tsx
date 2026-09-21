import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SEO } from "@/components/seo";
import { MarketingPageShell } from "@/components/marketing-page-shell";
import { getRegisterHref } from "@/lib/register-link";
import { PRICING_CONFIG } from "@shared/pricing";
import { Check, ArrowRight } from "lucide-react";

type Row = {
  topic: string;
  familyRoots: string;
  ancestry: string;
  social: string;
  chat: string;
};

const rows: Row[] = [
  {
    topic: "Private by default",
    familyRoots:
      "Invitation-only living trees — not a public billboard. Outsiders do not browse your family by default.",
    ancestry:
      "Trees can be private, but the product centers on historical records and paid subscriptions.",
    social:
      "Public-by-default feeds and ads; family photos and posts often reach a wider audience than you intend.",
    chat:
      "Chats are private between participants, but there is no structured tree or lasting family graph.",
  },
  {
    topic: "Relationship labels",
    familyRoots:
      "Family trees plus invited circles — labeled connections inside your private network.",
    ancestry: "Genealogy relationships for researched trees and historical people.",
    social: "Friends / follows — not a clear family map.",
    chat: "Group membership only — no relationship labels.",
  },
  {
    topic: "How you collaborate",
    familyRoots: "Living collaboration — relatives build and update a shared private network together.",
    ancestry: "Primarily solo research with optional sharing of trees and findings.",
    social: "Unstructured feed of posts, comments, and reactions.",
    chat: "Chaotic group chat threads that are hard to turn into a lasting tree.",
  },
  {
    topic: "Historical records",
    familyRoots:
      "FamilySearch integration where enabled (import limits vary by plan) — not a records warehouse itself.",
    ancestry: "Deep historical records libraries and DNA-scale matching (paid subscriptions).",
    social: "Not designed for census or archival research.",
    chat: "Not a records tool.",
  },
  {
    topic: "Free plan",
    familyRoots: `First ${PRICING_CONFIG.freeTierCredits} member profiles free, unlimited trees — no credit card required to start.`,
    ancestry: "Limited free browsing; full research typically needs a paid subscription.",
    social: "Free to use, with ads and public-by-default sharing.",
    chat: "Free messaging apps you already use.",
  },
  {
    topic: "Paid plans",
    familyRoots:
      "Paid plans from $4.99–$24.99/mo (Cultivator, Heritage, Legacy). Extra member profiles via one-time packs after the free allotment.",
    ancestry: "Paid subscription for full records / DNA features — pricing varies by product and region.",
    social: "Mostly free; optional boosts and ads.",
    chat: "Usually free; optional business plans on some apps.",
  },
];

export default function Comparison() {
  const registerHref = getRegisterHref();
  const freeProfiles = PRICING_CONFIG.freeTierCredits;

  return (
    <MarketingPageShell title="Compare">
      <SEO
        title="Compare: FamilyRoots vs. the alternatives"
        description="An honest look at FamilyRoots versus Ancestry/MyHeritage, Facebook & social, and WhatsApp-style group chats — so you can pick the right tool."
      />
      <main>
        <section className="border-b border-border bg-gradient-to-br from-primary/10 via-background to-accent/10">
          <div className="container mx-auto max-w-5xl px-4 py-14 text-center md:py-20">
            <h1 className="font-serif text-3xl font-bold md:text-5xl" data-testid="text-compare-title">
              Compare: FamilyRoots vs. the alternatives
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground leading-relaxed" data-testid="text-compare-lead">
              FamilyRoots is not the only way to keep a family story. Here is an honest look so you can pick the right tool.
            </p>
          </div>
        </section>

        <section className="container mx-auto max-w-6xl px-4 py-12">
          <div className="overflow-x-auto rounded-2xl border border-border bg-card/50">
            <table className="w-full min-w-[720px] text-left text-sm" data-testid="table-compare">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="p-4 font-semibold w-[16%]">Topic</th>
                  <th className="p-4 font-semibold w-[21%]">FamilyRoots</th>
                  <th className="p-4 font-semibold w-[21%]">Ancestry / MyHeritage</th>
                  <th className="p-4 font-semibold w-[21%]">Facebook &amp; social</th>
                  <th className="p-4 font-semibold w-[21%]">WhatsApp / group chats</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.topic} className="border-b border-border align-top">
                    <th className="p-4 font-medium text-foreground">{row.topic}</th>
                    <td className="p-4 text-muted-foreground">{row.familyRoots}</td>
                    <td className="p-4 text-muted-foreground">{row.ancestry}</td>
                    <td className="p-4 text-muted-foreground">{row.social}</td>
                    <td className="p-4 text-muted-foreground">{row.chat}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="container mx-auto max-w-5xl px-4 pb-8">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardContent className="space-y-3 p-6">
                <h2 className="font-serif text-xl font-semibold">When FamilyRoots is right</h2>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {[
                    "You want a living private network relatives can collaborate on",
                    "You need circles beyond a public social feed",
                    "You want the tree invisible to outsiders by default",
                  ].map((item) => (
                    <li key={item} className="flex gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-3 p-6">
                <h2 className="font-serif text-xl font-semibold">When something else is better</h2>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>
                    <strong className="text-foreground">FamilySearch</strong> — deep census and archival research (free); FamilyRoots can import where FamilySearch integration is enabled.
                  </li>
                  <li>
                    <strong className="text-foreground">Ancestry / MyHeritage</strong> — DNA-scale matching and large historical libraries.
                  </li>
                  <li>
                    <strong className="text-foreground">Facebook</strong> — if you only want public reunion photos and an open social feed.
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="container mx-auto max-w-3xl px-4 pb-16 text-center">
          <p className="text-sm text-muted-foreground leading-relaxed" data-testid="text-compare-pricing">
            Pricing matches our live plans: first {freeProfiles} member profiles free with unlimited trees;
            paid plans from $4.99–$24.99/mo. After the free allotment, extra member profiles come from one-time packs.
            See{" "}
            <Link href="/pricing" className="underline-offset-4 hover:underline text-foreground">
              /pricing
            </Link>{" "}
            for current details.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" data-testid="button-compare-cta">
              <a href={registerHref}>
                Start free — no credit card
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/pricing">View pricing</Link>
            </Button>
          </div>
        </section>
      </main>
    </MarketingPageShell>
  );
}
