import { Shield } from "lucide-react";
import { SEO } from "@/components/seo";
import { MarketingPageShell } from "@/components/marketing-page-shell";

const sections = [
  {
    title: "Information we collect",
    content: "We collect information you provide when creating an account, building a tree or group, inviting members, uploading content, contacting support, or using other FamilyRoots features. We may also collect basic device, browser, and usage information needed to operate and improve the service.",
  },
  {
    title: "How we use information",
    content: "We use information to provide and secure FamilyRoots, maintain your account, display content to people you authorize, process requested services, communicate important updates, prevent misuse, and improve product performance.",
  },
  {
    title: "How information is shared",
    content: "FamilyRoots is designed around private, invitation-based networks. We share information with other users according to your network membership and privacy settings. We may also use service providers that help us host, secure, support, and operate the service. We do not sell personal information.",
  },
  {
    title: "Your choices",
    content: "You can review and update account and profile information, manage visibility settings, control invitations, and request account deletion through available account tools or by contacting us. Some records may be retained when required for security, legal, or operational purposes.",
  },
  {
    title: "Security and retention",
    content: "We use reasonable administrative and technical safeguards designed to protect information. No online service can guarantee absolute security. We retain information for as long as needed to provide the service, satisfy legal obligations, resolve disputes, and enforce agreements.",
  },
  {
    title: "Children and changes",
    content: "FamilyRoots is not directed to children who cannot legally consent to online services in their location. Parents and guardians should supervise family information involving minors. We may update this policy as the service changes and will post the revised version here.",
  },
  {
    title: "Contact",
    content: "Questions or requests about this privacy policy can be sent to pawint@me.com.",
  },
];

export default function Privacy() {
  return (
    <MarketingPageShell title="Privacy">
      <SEO
        title="Privacy Policy - FamilyRoots"
        description="Learn how FamilyRoots collects, uses, protects, and shares information."
      />
      <main>
        <section className="border-b border-border bg-gradient-to-br from-primary/10 via-background to-accent/10">
          <div className="container mx-auto max-w-4xl px-4 py-16 text-center md:py-20">
            <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <h1 className="font-serif text-4xl font-bold md:text-5xl">Privacy Policy</h1>
            <p className="mt-4 text-muted-foreground">Last updated September 7, 2026</p>
          </div>
        </section>

        <section className="container mx-auto max-w-4xl px-4 py-14">
          <div className="rounded-2xl border border-border bg-card/50 p-6 md:p-10">
            <p className="text-lg leading-relaxed text-muted-foreground">
              This policy explains how FamilyRoots handles information when you use our websites, applications, and related services.
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