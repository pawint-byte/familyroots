import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { X, Download, Share, Smartphone, Monitor, Plus } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}

function isMobile(): boolean {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

function isIOS(): boolean {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function isAndroid(): boolean {
  return /Android/i.test(navigator.userAgent);
}

function isSafari(): boolean {
  return /Safari/i.test(navigator.userAgent) && !/Chrome|CriOS|FxiOS/i.test(navigator.userAgent);
}

export function PWAInstallBanner() {
  const [show, setShow] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;

    const dismissedAt = localStorage.getItem("pwa-install-dismissed");
    if (dismissedAt) {
      const daysSince = (Date.now() - Number(dismissedAt)) / (1000 * 60 * 60 * 24);
      if (daysSince < 7) return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    const timeout = setTimeout(() => {
      if (isMobile() && !isStandalone()) {
        setShow(true);
      }
    }, 3000);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      clearTimeout(timeout);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setShow(false);
      }
      setDeferredPrompt(null);
    } else {
      setShowInstructions(true);
    }
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setShow(false);
    setDismissed(true);
    localStorage.setItem("pwa-install-dismissed", String(Date.now()));
  }, []);

  if (!show || dismissed || isStandalone()) return null;

  if (showInstructions) {
    return (
      <Card className="mx-4 mb-4 border-primary/30 bg-primary/5 dark:bg-primary/10 shadow-lg" data-testid="pwa-install-instructions">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start justify-between mb-3">
            <h3 className="font-semibold text-base flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-primary" />
              Install FamilyRoots
            </h3>
            <button onClick={handleDismiss} className="text-muted-foreground hover:text-foreground" data-testid="pwa-dismiss-instructions">
              <X className="h-4 w-4" />
            </button>
          </div>

          {isIOS() ? (
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">Add FamilyRoots to your home screen for quick access:</p>
              <div className="space-y-2">
                <div className="flex items-start gap-3 p-2 rounded-md bg-background/80">
                  <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold shrink-0">1</div>
                  <p>Tap the <strong>Share</strong> button <Share className="h-3.5 w-3.5 inline text-primary" /> at the bottom of Safari{!isSafari() && <span className="text-orange-600 dark:text-orange-400"> (open in Safari first)</span>}</p>
                </div>
                <div className="flex items-start gap-3 p-2 rounded-md bg-background/80">
                  <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold shrink-0">2</div>
                  <p>Scroll down and tap <strong>"Add to Home Screen"</strong> <Plus className="h-3.5 w-3.5 inline text-primary" /></p>
                </div>
                <div className="flex items-start gap-3 p-2 rounded-md bg-background/80">
                  <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold shrink-0">3</div>
                  <p>Tap <strong>"Add"</strong> in the top right corner</p>
                </div>
              </div>
              {!isSafari() && (
                <div className="mt-2 p-2 rounded-md bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300 text-xs">
                  You're not using Safari. For the best install experience, open this page in Safari.
                </div>
              )}
            </div>
          ) : isAndroid() ? (
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">Add FamilyRoots to your home screen for quick access:</p>
              <div className="space-y-2">
                <div className="flex items-start gap-3 p-2 rounded-md bg-background/80">
                  <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold shrink-0">1</div>
                  <p>Tap the <strong>menu</strong> (three dots) in the top right of Chrome</p>
                </div>
                <div className="flex items-start gap-3 p-2 rounded-md bg-background/80">
                  <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold shrink-0">2</div>
                  <p>Tap <strong>"Add to Home screen"</strong> or <strong>"Install app"</strong></p>
                </div>
                <div className="flex items-start gap-3 p-2 rounded-md bg-background/80">
                  <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold shrink-0">3</div>
                  <p>Tap <strong>"Install"</strong> to confirm</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">Install FamilyRoots for quick access:</p>
              <div className="space-y-2">
                <div className="flex items-start gap-3 p-2 rounded-md bg-background/80">
                  <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold shrink-0">1</div>
                  <p>Click the <strong>install icon</strong> <Download className="h-3.5 w-3.5 inline text-primary" /> in the address bar (or browser menu)</p>
                </div>
                <div className="flex items-start gap-3 p-2 rounded-md bg-background/80">
                  <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold shrink-0">2</div>
                  <p>Click <strong>"Install"</strong> to confirm</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mx-4 mb-4 border-primary/30 bg-primary/5 dark:bg-primary/10 shadow-lg" data-testid="pwa-install-banner">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/20 shrink-0">
            {isMobile() ? <Smartphone className="h-5 w-5 text-primary" /> : <Monitor className="h-5 w-5 text-primary" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">Get the FamilyRoots App</p>
            <p className="text-xs text-muted-foreground">
              {isMobile() ? "Add to your home screen for faster access" : "Install for a full-screen app experience"}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" onClick={handleInstall} className="gap-1.5" data-testid="pwa-install-button">
              <Download className="h-3.5 w-3.5" />
              Install
            </Button>
            <button onClick={handleDismiss} className="text-muted-foreground hover:text-foreground p-1" data-testid="pwa-dismiss-button">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
