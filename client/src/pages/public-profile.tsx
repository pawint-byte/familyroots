import { useRoute, useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, TreeDeciduous, UserPlus, Users, Mail, Calendar, Loader2, QrCode, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { queryClient } from "@/lib/queryClient";
import { ThemeToggle } from "@/components/theme-toggle";

interface PublicProfile {
  id: string;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  memberSince: string;
  treeCount: number;
  totalMembers: number;
}

export default function PublicProfilePage() {
  const [, params] = useRoute("/profile/:userId");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user: currentUser, isLoading: authLoading } = useAuth();
  const userId = params?.userId;

  const { data: profile, isLoading, error } = useQuery<PublicProfile>({
    queryKey: ['/api/users', userId, 'public'],
    queryFn: async () => {
      const res = await fetch(`/api/users/${userId}/public`);
      if (!res.ok) throw new Error('Profile not found');
      return res.json();
    },
    enabled: !!userId,
  });

  const sendConnectionRequest = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/connection-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: userId }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to send connection request');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Connection Request Sent!",
        description: `Your request to connect with ${profile?.firstName} has been sent.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/connection-requests'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Request Failed",
        description: error.message || "Could not send connection request",
        variant: "destructive",
      });
    },
  });

  if (isLoading || authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-primary/20" />
          <p className="text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b sticky top-0 bg-background z-10">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/")}
                data-testid="button-back"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-2">
                <TreeDeciduous className="h-6 w-6 text-primary" />
                <span className="text-xl font-semibold">FamilyRoots</span>
              </div>
            </div>
            <ThemeToggle />
          </div>
        </header>
        <main className="container mx-auto px-4 py-16 text-center">
          <Card className="max-w-md mx-auto">
            <CardContent className="py-8">
              <Users className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">Profile Not Found</h2>
              <p className="text-muted-foreground mb-6">
                This profile doesn't exist or is no longer available.
              </p>
              <Link href="/">
                <Button data-testid="button-go-home">Go to FamilyRoots</Button>
              </Link>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const initials = `${profile.firstName?.[0] || ''}${profile.lastName?.[0] || ''}`.toUpperCase() || '?';
  const isOwnProfile = currentUser?.id === userId;
  const memberSinceDate = new Date(profile.memberSince).toLocaleDateString('en-US', { 
    month: 'long', 
    year: 'numeric' 
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 bg-background z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
              data-testid="button-back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <TreeDeciduous className="h-6 w-6 text-primary" />
              <span className="text-xl font-semibold">FamilyRoots</span>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-lg">
        <Card>
          <CardHeader className="text-center pb-2">
            <div className="flex justify-center mb-4">
              <Avatar className="h-24 w-24 border-4 border-primary/20">
                <AvatarImage src={profile.profileImageUrl || undefined} />
                <AvatarFallback className="text-3xl bg-primary/10">{initials}</AvatarFallback>
              </Avatar>
            </div>
            <CardTitle className="text-2xl">
              {profile.firstName} {profile.lastName}
            </CardTitle>
            <CardDescription className="flex items-center justify-center gap-2 mt-1">
              <Calendar className="h-4 w-4" />
              Member since {memberSinceDate}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="p-4 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold text-primary">{profile.treeCount}</div>
                <div className="text-sm text-muted-foreground">Family Trees</div>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold text-primary">{profile.totalMembers}</div>
                <div className="text-sm text-muted-foreground">Family Members</div>
              </div>
            </div>

            {isOwnProfile ? (
              <div className="space-y-3">
                <Badge variant="secondary" className="w-full justify-center py-2">
                  This is your profile
                </Badge>
                <Link href="/my-qr">
                  <Button variant="outline" className="w-full" data-testid="button-view-my-qr">
                    <QrCode className="h-4 w-4 mr-2" />
                    View My QR Code
                  </Button>
                </Link>
              </div>
            ) : currentUser ? (
              <div className="space-y-3">
                <Button 
                  className="w-full" 
                  onClick={() => sendConnectionRequest.mutate()}
                  disabled={sendConnectionRequest.isPending}
                  data-testid="button-send-connection"
                >
                  {sendConnectionRequest.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <UserPlus className="h-4 w-4 mr-2" />
                  )}
                  Send Connection Request
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  Connect to collaborate on family trees together
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <Link href="/">
                  <Button className="w-full" data-testid="button-join-familyroots">
                    <TreeDeciduous className="h-4 w-4 mr-2" />
                    Join FamilyRoots to Connect
                  </Button>
                </Link>
                <p className="text-xs text-center text-muted-foreground">
                  Create a free account to connect with {profile.firstName} and start building your family tree
                </p>
              </div>
            )}

            <div className="border-t pt-4">
              <div className="bg-primary/5 rounded-lg p-4 text-center">
                <Users className="h-8 w-8 mx-auto text-primary mb-2" />
                <h4 className="font-medium text-sm mb-1">Build Your Family Tree Together</h4>
                <p className="text-xs text-muted-foreground">
                  FamilyRoots makes it easy for family members to collaborate, 
                  share profiles, and connect at reunions.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <Link href="/">
            <Button variant="ghost" className="text-muted-foreground" data-testid="link-learn-more">
              Learn more about FamilyRoots →
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
