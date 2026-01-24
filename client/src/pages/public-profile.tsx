import { useState, useEffect } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ArrowLeft, TreeDeciduous, UserPlus, Users, Calendar, Loader2, QrCode, Heart } from "lucide-react";
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

const RELATIONSHIP_OPTIONS = [
  { value: "son", label: "Their Son" },
  { value: "daughter", label: "Their Daughter" },
  { value: "parent", label: "Their Parent" },
  { value: "spouse", label: "Their Spouse" },
  { value: "sibling", label: "Their Sibling" },
  { value: "grandparent", label: "Their Grandparent" },
  { value: "grandchild", label: "Their Grandchild" },
  { value: "aunt", label: "Their Aunt" },
  { value: "uncle", label: "Their Uncle" },
  { value: "niece", label: "Their Niece" },
  { value: "nephew", label: "Their Nephew" },
  { value: "cousin", label: "Their Cousin" },
  { value: "in_law", label: "Their In-Law" },
  { value: "step_relative", label: "Their Step-Relative" },
  { value: "other", label: "Other Relationship" },
];

export default function PublicProfilePage() {
  const [, params] = useRoute("/profile/:userId");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user: currentUser, isLoading: authLoading } = useAuth();
  const userId = params?.userId;

  const [showConnectionDialog, setShowConnectionDialog] = useState(false);
  const [relationshipType, setRelationshipType] = useState("");
  const [customLabel, setCustomLabel] = useState("");
  const [message, setMessage] = useState("");

  // Store pending connection data for redirect after login (includes target user info)
  useEffect(() => {
    if (userId && !currentUser && !authLoading) {
      // Store both the redirect URL and the target user ID for the connection
      localStorage.setItem("pendingProfileRedirect", `/profile/${userId}`);
      localStorage.setItem("pendingConnectionUserId", userId);
    }
  }, [userId, currentUser, authLoading]);

  // Auto-open connection dialog if returning from signup flow
  useEffect(() => {
    if (currentUser && userId && !authLoading) {
      const pendingConnectionUserId = localStorage.getItem("pendingConnectionUserId");
      // Check if this is the profile we were trying to connect with
      if (pendingConnectionUserId === userId && currentUser.id !== userId) {
        // Clear the stored data and auto-open the dialog
        localStorage.removeItem("pendingConnectionUserId");
        localStorage.removeItem("pendingProfileRedirect");
        // Small delay to ensure page is fully rendered
        setTimeout(() => {
          setShowConnectionDialog(true);
        }, 500);
      }
    }
  }, [currentUser, userId, authLoading]);

  const { data: profile, isLoading, error } = useQuery<PublicProfile>({
    queryKey: ['/api/users', userId, 'public'],
    queryFn: async () => {
      const res = await fetch(`/api/users/${userId}/public`);
      if (!res.ok) throw new Error('Profile not found');
      return res.json();
    },
    enabled: !!userId,
  });

  // Check connection status with this user
  interface ConnectionStatus {
    status: 'self' | 'connected' | 'pending_sent' | 'pending_received' | 'not_connected';
    isConnected: boolean;
    hasPendingRequest: boolean;
    direction?: 'sent' | 'received';
    requestId?: string;
  }
  
  const { data: connectionStatus } = useQuery<ConnectionStatus>({
    queryKey: ['/api/user-connections/check', userId],
    queryFn: async () => {
      const res = await fetch(`/api/user-connections/check/${userId}`, { credentials: 'include' });
      if (!res.ok) return { status: 'not_connected', isConnected: false, hasPendingRequest: false };
      return res.json();
    },
    enabled: !!userId && !!currentUser && currentUser.id !== userId,
  });

  const sendConnectionRequest = useMutation({
    mutationFn: async (data: { relationshipType: string; customLabel?: string; message?: string }) => {
      const res = await fetch('/api/user-connection-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          targetUserId: userId,
          relationshipType: data.relationshipType,
          customLabel: data.customLabel,
          message: data.message,
        }),
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
        description: `Your request to connect with ${profile?.firstName} has been sent. They'll be notified to approve it.`,
      });
      setShowConnectionDialog(false);
      setRelationshipType("");
      setCustomLabel("");
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ['/api/user-connection-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user-connections/check', userId] });
    },
    onError: (error: Error) => {
      toast({
        title: "Request Failed",
        description: error.message || "Could not send connection request",
        variant: "destructive",
      });
    },
  });

  const handleSendRequest = () => {
    if (!relationshipType) {
      toast({
        title: "Select Relationship",
        description: "Please select how you're related to this person",
        variant: "destructive",
      });
      return;
    }

    sendConnectionRequest.mutate({
      relationshipType,
      customLabel: relationshipType === "other" ? customLabel : undefined,
      message: message || undefined,
    });
  };

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
                {connectionStatus?.isConnected ? (
                  <>
                    <Badge variant="secondary" className="w-full justify-center py-2">
                      <Users className="h-4 w-4 mr-2 text-primary" />
                      <span className="text-primary font-medium">Already Connected</span>
                    </Badge>
                    <p className="text-xs text-center text-muted-foreground">
                      You're already connected with {profile.firstName || 'this person'}. View your connections on the dashboard.
                    </p>
                  </>
                ) : connectionStatus?.status === 'pending_sent' ? (
                  <>
                    <Badge variant="secondary" className="w-full justify-center py-2">
                      <Loader2 className="h-4 w-4 mr-2" />
                      Request Pending
                    </Badge>
                    <p className="text-xs text-center text-muted-foreground">
                      You've already sent a connection request to {profile.firstName || 'this person'}. Waiting for their approval.
                    </p>
                  </>
                ) : connectionStatus?.status === 'pending_received' ? (
                  <>
                    <Link href="/dashboard">
                      <Button className="w-full" data-testid="button-view-pending-request">
                        <Users className="h-4 w-4 mr-2" />
                        View Their Request
                      </Button>
                    </Link>
                    <p className="text-xs text-center text-muted-foreground">
                      {profile.firstName || 'This person'} has sent you a connection request. Check your dashboard to approve it.
                    </p>
                  </>
                ) : (
                  <>
                    <Button 
                      className="w-full" 
                      onClick={() => setShowConnectionDialog(true)}
                      data-testid="button-send-connection"
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Connect with {profile.firstName || 'this person'}
                    </Button>
                    <p className="text-xs text-center text-muted-foreground">
                      Tell {profile.firstName || 'them'} how you're related to collaborate on family trees together
                    </p>
                  </>
                )}
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
                  Create a free account to connect with {profile.firstName || 'this person'} and start building your family tree
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
              Learn more about FamilyRoots
            </Button>
          </Link>
        </div>
      </main>

      {/* Connection Request Dialog */}
      <Dialog open={showConnectionDialog} onOpenChange={setShowConnectionDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-primary" />
              Connect with {profile.firstName}
            </DialogTitle>
            <DialogDescription>
              Tell {profile.firstName} how you're related so they can add you to their family tree.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="relationship">I am {profile.firstName}'s...</Label>
              <Select value={relationshipType} onValueChange={setRelationshipType}>
                <SelectTrigger id="relationship" data-testid="select-relationship">
                  <SelectValue placeholder="Select your relationship" />
                </SelectTrigger>
                <SelectContent>
                  {RELATIONSHIP_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {relationshipType === "other" && (
              <div className="space-y-2">
                <Label htmlFor="customLabel">Describe your relationship</Label>
                <Input
                  id="customLabel"
                  placeholder="e.g., Family friend, Godchild..."
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
                  data-testid="input-custom-label"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="message">Add a message (optional)</Label>
              <Textarea
                id="message"
                placeholder={`Hi ${profile.firstName || 'there'}, it was great seeing you at the reunion!`}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="resize-none"
                rows={3}
                data-testid="input-message"
              />
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setShowConnectionDialog(false)}
              data-testid="button-cancel-connection"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendRequest}
              disabled={!relationshipType || sendConnectionRequest.isPending}
              data-testid="button-confirm-connection"
            >
              {sendConnectionRequest.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4 mr-2" />
              )}
              Send Connection Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
