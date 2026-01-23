import { useState, useEffect, useCallback, useRef } from "react";
import { RefreshCw, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MaintenanceModeProps {
  children: React.ReactNode;
}

const HEALTH_CHECK_INTERVAL = 10000; // Check every 10 seconds
const INITIAL_CHECK_TIMEOUT = 5000; // 5 second timeout for initial health check

export function MaintenanceMode({ children }: MaintenanceModeProps) {
  const [isServerAvailable, setIsServerAvailable] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const wasInMaintenanceMode = useRef(false);
  const hasCompletedInitialCheck = useRef(false);

  const checkServerHealth = useCallback(async () => {
    setIsChecking(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), INITIAL_CHECK_TIMEOUT);
      
      const response = await fetch("/api/health", {
        method: "GET",
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        // Server is available - reload only if we were previously in maintenance
        if (wasInMaintenanceMode.current && hasCompletedInitialCheck.current) {
          window.location.reload();
          return;
        }
        wasInMaintenanceMode.current = false;
        setIsServerAvailable(true);
      } else {
        // Server responded but with error (e.g., 503)
        wasInMaintenanceMode.current = true;
        setIsServerAvailable(false);
      }
      
      hasCompletedInitialCheck.current = true;
    } catch (error) {
      // Network error - server is completely unavailable
      wasInMaintenanceMode.current = true;
      setIsServerAvailable(false);
      hasCompletedInitialCheck.current = true;
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    checkServerHealth();
    
    const interval = setInterval(() => {
      if (!isServerAvailable) {
        checkServerHealth();
      }
    }, HEALTH_CHECK_INTERVAL);

    return () => clearInterval(interval);
  }, [checkServerHealth, isServerAvailable]);

  if (isServerAvailable === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-primary/20" />
          <p className="text-muted-foreground">Connecting...</p>
        </div>
      </div>
    );
  }

  if (isServerAvailable === false) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
            <Wrench className="w-10 h-10 text-primary animate-pulse" />
          </div>
          
          <div className="space-y-2">
            <h1 className="text-2xl font-serif font-bold text-foreground">
              We're Making Improvements
            </h1>
            <p className="text-muted-foreground">
              FamilyRoots is being updated with new features. We'll be back in just a moment!
            </p>
          </div>

          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {isChecking ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Checking...</span>
                </>
              ) : (
                <>
                  <span>Auto-checking every 10 seconds</span>
                </>
              )}
            </div>

            <Button
              variant="outline"
              onClick={checkServerHealth}
              disabled={isChecking}
              data-testid="button-check-again"
            >
              {isChecking ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Check Again
            </Button>
          </div>

          <div className="pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground">
              Thank you for your patience while we make FamilyRoots even better for your family.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
