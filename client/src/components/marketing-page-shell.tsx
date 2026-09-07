import type { ReactNode } from "react";
import { Link } from "wouter";
import { ArrowLeft, Trees } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";

interface MarketingPageShellProps {
  children: ReactNode;
  title: string;
}

export function MarketingPageShell({ children, title }: MarketingPageShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="container mx-auto flex min-h-16 items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/" className="gap-2" data-testid="link-back-home">
                <ArrowLeft className="h-4 w-4" />
                Home
              </Link>
            </Button>
            <div className="hidden items-center gap-2 border-l border-border pl-4 sm:flex">
              <Trees className="h-5 w-5 text-primary" />
              <span className="font-serif font-semibold">FamilyRoots</span>
              <span className="text-muted-foreground">/</span>
              <span className="text-sm text-muted-foreground">{title}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeToggle />
            <Button asChild size="sm">
              <Link href="/login">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      {children}

      <footer className="border-t border-border py-8">
        <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 text-sm text-muted-foreground md:flex-row">
          <Link href="/" className="flex items-center gap-2 text-foreground">
            <Trees className="h-5 w-5 text-primary" />
            <span className="font-serif">FamilyRoots</span>
          </Link>
          <p>{new Date().getFullYear()} FamilyRoots. All rights reserved.</p>
          <nav className="flex items-center gap-4">
            <Link href="/about" className="hover:text-foreground">About</Link>
            <Link href="/blog" className="hover:text-foreground">Blog</Link>
            <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link href="/terms" className="hover:text-foreground">Terms</Link>
            <Link href="/faq" className="hover:text-foreground">FAQ</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}