import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { SEO } from "@/components/seo";
import { apiRequest } from "@/lib/queryClient";
import { getSignupAttributionPayload } from "@/lib/attribution";
import { Trees, Users, Crown, Edit, Eye, AlertCircle, CheckCircle2 } from "lucide-react";

export default function JoinTree() {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [joined, setJoined] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/invitations", inviteCode],
    queryFn: async () => {
      const res = await fetch(`/api/invitations/${inviteCode}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Invalid invitation");
      }
      return res.json();
    },
    enabled: !!inviteCode,
  });

  const joinMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/invitations/${inviteCode}/accept`, getSignupAttributionPayload());
    },
    onSuccess: (response: any) => {
      setJoined(true);
      toast({
        title: "Welcome!",
        description: `You've joined "${response.treeName}"`,
      });
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: err.message || "Failed to join tree",
        variant: "destructive",
      });
    },
  });

  const getRoleInfo = (role: string) => {
    switch (role) {
      case "co_owner":
        return {
          icon: <Crown className="h-5 w-5 text-yellow-500" />,
          label: "Co-Owner",
          description: "Full control over tree, members, settings, and invitations",
        };
      case "editor":
        return {
          icon: <Edit className="h-5 w-5 text-blue-500" />,
          label: "Editor",
          description: "Can add and edit family members",
        };
      default:
        return {
          icon: <Eye className="h-5 w-5 text-muted-foreground" />,
          label: "Viewer",
          description: "Can view the tree and members",
        };
    }
  };

  const roleInfo = data?.role ? getRoleInfo(data.role) : null;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Skeleton className="h-16 w-16 rounded-full mx-auto mb-4" />
            <Skeleton className="h-6 w-48 mx-auto mb-2" />
            <Skeleton className="h-4 w-64 mx-auto" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <SEO title="Invalid Invitation | FamilyRoots" description="This invitation link is invalid or has expired" />
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle className="font-serif">Invalid Invitation</CardTitle>
            <CardDescription>
              {(error as Error).message || "This invitation link is invalid or has expired"}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button onClick={() => navigate("/")} data-testid="button-go-home">
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (joined) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <SEO title="Joined Successfully | FamilyRoots" description="You have successfully joined a family tree" />
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle className="font-serif">You're In!</CardTitle>
            <CardDescription>
              You've successfully joined the family tree
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button onClick={() => navigate("/dashboard")} data-testid="button-go-dashboard">
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <SEO 
        title={`Join ${data?.treeName || "Family Tree"} | FamilyRoots`}
        description="You've been invited to collaborate on a family tree"
      />
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
            <Trees className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="font-serif text-2xl">Join Family Tree</CardTitle>
          <CardDescription>
            You've been invited to collaborate on
          </CardDescription>
          <h2 className="text-xl font-semibold mt-2" data-testid="text-tree-name">
            {data?.treeName}
          </h2>
        </CardHeader>
        <CardContent className="space-y-6">
          {roleInfo && (
            <div className="flex items-start gap-3 p-4 bg-muted rounded-lg">
              {roleInfo.icon}
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">Your Role:</span>
                  <Badge variant="outline">{roleInfo.label}</Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {roleInfo.description}
                </p>
              </div>
            </div>
          )}

          {!user ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                Sign in to accept this invitation
              </p>
              <Button 
                className="w-full" 
                onClick={() => navigate(`/`)}
                data-testid="button-sign-in"
              >
                Sign In to Join
              </Button>
            </div>
          ) : (
            <Button
              className="w-full"
              size="lg"
              onClick={() => joinMutation.mutate()}
              disabled={joinMutation.isPending}
              data-testid="button-accept-invite"
            >
              <Users className="h-4 w-4 mr-2" />
              {joinMutation.isPending ? "Joining..." : "Accept Invitation"}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
