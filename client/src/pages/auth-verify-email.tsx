import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CheckCircle, XCircle, Loader2, TreeDeciduous } from "lucide-react";

export default function AuthVerifyEmail() {
  const [, setLocation] = useLocation();
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Invalid verification link");
      return;
    }

    fetch(`/api/auth/verify-email/${token}`, { credentials: "include" })
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) {
          setStatus("success");
          setMessage(data.message || "Email verified successfully");
        } else {
          setStatus("error");
          setMessage(data.message || "Verification failed");
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("Verification failed. Please try again.");
      });
  }, [token]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md" data-testid="verify-email-card">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            {status === "loading" && <Loader2 className="h-10 w-10 text-primary animate-spin" />}
            {status === "success" && <CheckCircle className="h-10 w-10 text-green-600" />}
            {status === "error" && <XCircle className="h-10 w-10 text-destructive" />}
          </div>
          <CardTitle className="text-2xl font-bold">
            {status === "loading" && "Verifying..."}
            {status === "success" && "Email Verified!"}
            {status === "error" && "Verification Failed"}
          </CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardContent>
          {status === "success" && (
            <Button
              className="w-full"
              onClick={() => setLocation("/login?verified=true")}
              data-testid="button-go-to-login"
            >
              Go to Login
            </Button>
          )}
          {status === "error" && (
            <Button
              className="w-full"
              variant="outline"
              onClick={() => setLocation("/login")}
              data-testid="button-back-to-login"
            >
              Back to Login
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
