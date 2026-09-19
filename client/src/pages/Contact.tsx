import { Link } from "wouter";
import { SEO } from "@/components/seo";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";

const CONTACT_EMAIL = "pawint@me.com";

export default function Contact() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEO
        title="Contact FamilyRoots"
        description="Reach the FamilyRoots team about private living family trees, invites, billing, or privacy questions."
        canonicalUrl="/contact"
      />
      <main className="mx-auto max-w-2xl px-4 py-12 sm:py-16">
        <p className="mb-4 text-sm text-muted-foreground">
          <Link href="/" className="underline-offset-4 hover:underline">
            Home
          </Link>
          {" · "}
          <Link href="/faq" className="underline-offset-4 hover:underline">
            FAQ
          </Link>
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Contact</h1>
        <p className="mt-4 text-muted-foreground leading-relaxed">
          FamilyRoots is built for invitation-only living trees — not a public billboard.
          Questions about privacy, invites, your account, or billing? Email us and we’ll
          get back as soon as we can.
        </p>
        <Card className="mt-8">
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Mail className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="font-medium">Email</p>
                <a
                  className="text-primary underline-offset-4 hover:underline"
                  href={`mailto:${CONTACT_EMAIL}?subject=FamilyRoots%20contact`}
                >
                  {CONTACT_EMAIL}
                </a>
                <p className="mt-2 text-sm text-muted-foreground">
                  Please don’t send passwords, seed phrases, or other people’s private
                  data in email.
                </p>
              </div>
            </div>
            <Button asChild className="shrink-0">
              <a href={`mailto:${CONTACT_EMAIL}?subject=FamilyRoots%20contact`}>
                Open email
              </a>
            </Button>
          </CardContent>
        </Card>
        <p className="mt-8 text-sm text-muted-foreground">
          Prefer self-serve answers first? See the {" "}
          <Link href="/faq" className="underline-offset-4 hover:underline">
            FAQ
          </Link>
          .
        </p>
      </main>
    </div>
  );
}
