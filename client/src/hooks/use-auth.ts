import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import type { User } from "@shared/models/auth";
import { trackSignUp } from "@/lib/tracking";
import { apiRequest } from "@/lib/queryClient";

// Complete referral if user signed up through a referral link
async function completeReferralIfExists(): Promise<void> {
  const referralCode = localStorage.getItem("referralCode");
  if (referralCode) {
    try {
      await apiRequest("POST", "/api/referrals/complete", { code: referralCode });
      localStorage.removeItem("referralCode"); // Clear after completing
    } catch {
      // Silently fail - referral might already be completed or invalid
    }
  }
}

async function fetchUser(): Promise<User | null> {
  const response = await fetch("/api/auth/user", {
    credentials: "include",
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`${response.status}: ${response.statusText}`);
  }

  return response.json();
}

async function logout(authProvider?: string): Promise<void> {
  if (authProvider === "replit") {
    window.location.href = "/api/logout";
    return;
  }
  try {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
  } catch {
  }
  window.location.href = "/login";
}

export function useAuth() {
  const queryClient = useQueryClient();
  const hasTrackedSignUp = useRef(false);
  
  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: fetchUser,
    retry: false,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  useEffect(() => {
    if (user && !hasTrackedSignUp.current) {
      const trackedKey = `reddit_signup_tracked_${user.id}`;
      if (!localStorage.getItem(trackedKey)) {
        trackSignUp();
        localStorage.setItem(trackedKey, 'true');
      }
      // Always try to complete referral when user signs in (handles edge cases)
      // Server-side will prevent duplicate completions
      completeReferralIfExists();
      hasTrackedSignUp.current = true;
    }
  }, [user]);

  const logoutMutation = useMutation({
    mutationFn: () => logout(user?.authProvider),
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/user"], null);
    },
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
  };
}
