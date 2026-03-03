import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { Eye, EyeOff, UserPlus, TreeDeciduous, Mail } from "lucide-react";

const registerSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Please enter a valid email address"),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function AuthRegister() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null);

  const params = new URLSearchParams(window.location.search);
  const prefillEmail = params.get("email") || "";

  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { firstName: "", lastName: "", email: prefillEmail, password: "", confirmPassword: "" },
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

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterForm) => {
      const { confirmPassword, ...payload } = data;
      const res = await apiRequest("POST", "/api/auth/register", payload);
      return res.json();
    },
    onSuccess: (data) => {
      if (data.emailVerificationSent) {
        setVerificationEmail(form.getValues("email"));
      }
    },
    onError: (error: any) => {
      toast({
        title: "Registration failed",
        description: error.message || "Could not create account",
        variant: "destructive",
      });
    },
  });

  if (verificationEmail) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md" data-testid="verification-sent-card">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <Mail className="h-10 w-10 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold">Verify Your Email</CardTitle>
            <CardDescription>
              We've sent a verification link to <strong>{verificationEmail}</strong>.
              You must verify your email before you can sign in.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm text-amber-800 dark:text-amber-200">
              Check your inbox (and spam folder) for an email from FamilyRoots. Click the verification link, then come back here to sign in.
            </div>
            <Button
              className="w-full"
              variant="outline"
              onClick={() => resendMutation.mutate(verificationEmail)}
              disabled={resendMutation.isPending}
              data-testid="button-resend-verification"
            >
              {resendMutation.isPending ? "Sending..." : "Resend Verification Email"}
            </Button>
            <Button
              className="w-full"
              onClick={() => setLocation("/login")}
              data-testid="button-go-to-login"
            >
              Go to Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md" data-testid="register-card">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <TreeDeciduous className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Create Your Account</CardTitle>
          <CardDescription>Join FamilyRoots and start building your tree</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => registerMutation.mutate(data))} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input placeholder="John" data-testid="input-first-name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Doe" data-testid="input-last-name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
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
                          placeholder="Min 8 chars, uppercase, lowercase, number"
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
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm Password</FormLabel>
                    <FormControl>
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="Re-enter your password"
                        data-testid="input-confirm-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full"
                disabled={registerMutation.isPending}
                data-testid="button-register"
              >
                {registerMutation.isPending ? "Creating account..." : "Create Account"}
                {!registerMutation.isPending && <UserPlus className="ml-2 h-4 w-4" />}
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
            Already have an account?{" "}
            <a
              href="/login"
              className="text-primary hover:underline font-medium"
              data-testid="link-login"
              onClick={(e) => { e.preventDefault(); setLocation("/login"); }}
            >
              Sign in
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
