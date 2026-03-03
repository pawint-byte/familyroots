import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { Eye, EyeOff, LogIn, TreeDeciduous, Mail } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function AuthLogin() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);

  const params = new URLSearchParams(window.location.search);
  const verified = params.get("verified") === "true";

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const resendMutation = useMutation({
    mutationFn: async (email: string) => {
      const res = await apiRequest("POST", "/api/auth/resend-verification", { email });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Verification email sent",
        description: "Please check your inbox and click the verification link.",
      });
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginForm) => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      const body = await res.json();
      if (!res.ok) {
        throw body;
      }
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setLocation("/");
    },
    onError: (error: any) => {
      if (error?.code === "USER_NOT_FOUND") {
        const email = form.getValues("email");
        setLocation(`/register?email=${encodeURIComponent(email)}`);
        return;
      }
      if (error?.code === "EMAIL_NOT_VERIFIED") {
        setUnverifiedEmail(error.email || form.getValues("email"));
        return;
      }
      toast({
        title: "Sign in failed",
        description: error?.message || "Invalid email or password",
        variant: "destructive",
      });
    },
  });

  if (unverifiedEmail) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md" data-testid="verify-email-card">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <Mail className="h-10 w-10 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold">Verify Your Email</CardTitle>
            <CardDescription>
              You need to verify your email address before you can sign in.
              Check your inbox at <strong>{unverifiedEmail}</strong> for the verification link.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              className="w-full"
              variant="outline"
              onClick={() => resendMutation.mutate(unverifiedEmail)}
              disabled={resendMutation.isPending}
              data-testid="button-resend-verification"
            >
              {resendMutation.isPending ? "Sending..." : "Resend Verification Email"}
            </Button>
            <Button
              className="w-full"
              variant="ghost"
              onClick={() => setUnverifiedEmail(null)}
              data-testid="button-back-to-login"
            >
              Back to Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md" data-testid="login-card">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <TreeDeciduous className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Welcome Back</CardTitle>
          <CardDescription>Sign in to your FamilyRoots account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {verified && (
            <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-3 text-sm text-green-800 dark:text-green-200" data-testid="text-verified">
              Email verified successfully! You can now sign in.
            </div>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => loginMutation.mutate(data))} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="you@example.com"
                        data-testid="input-email"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="Enter your password"
                          data-testid="input-password"
                          {...field}
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          onClick={() => setShowPassword(!showPassword)}
                          data-testid="button-toggle-password"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end">
                <a
                  href="/forgot-password"
                  className="text-sm text-primary hover:underline"
                  data-testid="link-forgot-password"
                  onClick={(e) => { e.preventDefault(); setLocation("/forgot-password"); }}
                >
                  Forgot password?
                </a>
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={loginMutation.isPending}
                data-testid="button-sign-in"
              >
                {loginMutation.isPending ? "Signing in..." : "Sign In"}
                {!loginMutation.isPending && <LogIn className="ml-2 h-4 w-4" />}
              </Button>
            </form>
          </Form>

          <div className="relative">
            <Separator />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2 text-xs text-muted-foreground">
              or
            </span>
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => { window.location.href = "/api/login"; }}
            data-testid="button-continue-replit"
          >
            Continue with Replit
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <a
              href="/register"
              className="text-primary hover:underline font-medium"
              data-testid="link-register"
              onClick={(e) => { e.preventDefault(); setLocation("/register"); }}
            >
              Create one
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
