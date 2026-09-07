import { Scale } from "lucide-react";
import { SEO } from "@/components/seo";
import { MarketingPageShell } from "@/components/marketing-page-shell";

const sections = [
  {
    title: "Using FamilyRoots",
    content: "You may use FamilyRoots only in compliance with applicable law and these terms. You are responsible for information and content submitted through your account and for keeping your account credentials secure.",
  },
  {
    title: "Accounts and permissions",
    content: "Provide accurate account information and do not impersonate others. Tree and group owners may grant roles and permissions to other users. You must respect those permissions and may not access or disclose information outside the access provided to you.",
  },
  {
    title: "Your content",
    content: "You retain ownership of content you submit. You grant FamilyRoots the limited rights needed to host, store, process, display, and transmit that content to operate the service and honor the sharing choices you make.",
  },
  {
    title: "Acceptable use",
    content: "Do not misuse the service, interfere with its operation, attempt unauthorized access, upload malicious material, violate another person's privacy or intellectual-property rights, or use FamilyRoots for unlawful, deceptive, abusive, or harmful activity.",
  },
  {
    title: "Third-party services",
    content: "Some features may rely on third-party services. Their availability and terms may differ from ours. FamilyRoots is not responsible for third-party services or content that we do not control.",
  },
  {
    title: "Availability and termination",
    content: "We may modify, suspend, or discontinue features and may restrict accounts that violate these terms or threaten the service or its users. You may stop using FamilyRoots at any time and may request account deletion through available account tools or by contacting us.",
  },
  {
    title: "Disclaimers and liability",
    content: "FamilyRoots is provided on an as-available basis to the extent permitted by law. We do not guarantee uninterrupted operation or that user-provided family information is complete or accurate. Liability is limited to the maximum extent permitted by applicable law.",
  },
  {
    title: "Changes and contact",
    content: "We may update these terms as FamilyRoots evolves. Continued use after an updated version takes effect constitutes acceptance where permitted by law. Questions can be sent to pawint@me.com.",
  },
];

export default function Terms() {
  return (
    <MarketingPageShell title="Terms">
      <SEO
        title="Terms of Service - FamilyRoots"
        description="Review the terms that apply when using FamilyRoots."
      />
      <main>
        <section className="border-b border-border bg-gradient-to-br from-primary/10 via-background to-accent/10">
          <div className="container mx-auto max-w-4xl px-4 py-16 text-center md:py-20">
            <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Scale className="h-6 w-6 text-primary" />
            </div>
            <h1 className="font-serif text-4xl font-bold md:text-5xl">Terms of Service</h1>
            <p className="mt-4 text-muted-foreground">Last updated September 7, 2026</p>
          </div>
        </section>

        <section className="container mx-auto max-w-4xl px-4 py-14">
          <div className="rounded-2xl border border-border bg-card/50 p-6 md:p-10">
            <p className="text-lg leading-relaxed text-muted-foreground">
              These terms govern your access to and use of FamilyRoots. By using the service, you agree to these terms.
            </p>
            <div className="mt-10 space-y-9">
              {sections.map((section) => (
                <section key={section.title}>
                  <h2 className="font-serif text-2xl font-semibold">{section.title}</h2>
                  <p className="mt-3 leading-relaxed text-muted-foreground">{section.content}</p>
                </section>
              ))}
            </div>
          </div>
        </section>
      </main>
    </MarketingPageShell>
  );
}