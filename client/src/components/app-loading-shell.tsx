import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Trees } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface AppLoadingShellProps {
  /**
   * Retrying the bootstrap request should keep the shell mounted so the page
   * does not flash back to an empty root between attempts.
   */
  onRetry?: () => Promise<unknown> | unknown;
  hasError?: boolean;
  context?: "public" | "app";
}

const LOADING_TIMEOUT = 8000;

/**
 * The first screen should still look like FamilyRoots while the session or
 * server health request is pending. Keeping this structural shell stable is
 * especially important for direct links to public pages.
 */
export function AppLoadingShell({
  onRetry,
  hasError = false,
  context = "app",
}: AppLoadingShellProps) {
  const [hasTimedOut, setHasTimedOut] = useState(false);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setHasTimedOut(true), LOADING_TIMEOUT);
    return () => window.clearTimeout(timeoutId);
  }, [retryAttempt]);

  const handleRetry = useCallback(async () => {
    if (!onRetry || isRetrying) return;

    setHasTimedOut(false);
    setIsRetrying(true);
    setRetryAttempt((attempt) => attempt + 1);

    try {
      await onRetry();
    } finally {
      setIsRetrying(false);
    }
  }, [isRetrying, onRetry]);

  const showRecovery = hasTimedOut || hasError;
  const heading = context === "public"
    ? "Getting this page ready"
    : "Getting FamilyRoots ready";

  return (
    <div
      className="min-h-screen bg-background text-foreground"
      data-testid="app-loading-shell"
      aria-busy={!showRecovery}
      aria-live="polite"
    >
      <header className="border-b border-border bg-background/90">
        <div className="container mx-auto flex min-h-16 items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
              <Trees className="h-5 w-5 text-primary" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <div className="font-serif font-semibold">FamilyRoots</div>
              <Skeleton className="h-2 w-24" aria-hidden="true" />
            </div>
          </div>
          <div className="hidden items-center gap-3 sm:flex">
            <Skeleton className="h-8 w-16" aria-hidden="true" />
            <Skeleton className="h-8 w-20" aria-hidden="true" />
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-5xl px-4 py-12 md:py-20">
        <div className="mx-auto max-w-3xl space-y-8">
          <div className="space-y-4">
            <Skeleton className="h-3 w-28" aria-hidden="true" />
            <Skeleton className="h-10 w-full max-w-2xl" aria-hidden="true" />
            <Skeleton className="h-5 w-full max-w-xl" aria-hidden="true" />
            <Skeleton className="h-5 w-4/5 max-w-lg" aria-hidden="true" />
          </div>

          <div className="grid gap-4 sm:grid-cols-3" data-testid="loading-skeleton">
            <Skeleton className="h-32 rounded-2xl" aria-hidden="true" />
            <Skeleton className="h-32 rounded-2xl" aria-hidden="true" />
            <Skeleton className="h-32 rounded-2xl" aria-hidden="true" />
          </div>

          <section className="rounded-2xl border border-border bg-card/50 p-6 md:p-8">
            <div className="flex items-start gap-4">
              <div className="mt-1 h-3 w-3 shrink-0 rounded-full bg-primary/60" aria-hidden="true" />
              <div className="min-w-0 flex-1 space-y-3">
                <h1 className="font-serif text-xl font-semibold">{heading}</h1>
                {showRecovery ? (
                  <>
                    <p className="text-sm leading-relaxed text-muted-foreground" data-testid="loading-timeout-message">
                      {hasError
                        ? "We couldn't connect to FamilyRoots just yet."
                        : "This is taking longer than expected. Your page is still safe to retry."}
                    </p>
                    {onRetry ? (
                      <Button
                        type="button"
                        onClick={handleRetry}
                        disabled={isRetrying}
                        data-testid="button-loading-retry"
                      >
                        <RefreshCw className={`mr-2 h-4 w-4 ${isRetrying ? "animate-spin" : ""}`} aria-hidden="true" />
                        {isRetrying ? "Trying again..." : "Try again"}
                      </Button>
                    ) : null}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Loading the latest FamilyRoots experience…
                  </p>
                )}
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}