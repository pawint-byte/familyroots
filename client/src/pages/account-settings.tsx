import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Shield, User, Clock, AlertTriangle, Save, Trash2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { AccountHeir } from "@shared/schema";

export default function AccountSettings() {
  const { user, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [heirName, setHeirName] = useState("");
  const [heirEmail, setHeirEmail] = useState("");
  const [relationship, setRelationship] = useState("");
  const [notes, setNotes] = useState("");
  const [inactivityMonths, setInactivityMonths] = useState("6");

  const { data: accountSettings, isLoading: settingsLoading } = useQuery<{
    lastActivityAt: string | null;
    inactivityReminderSentAt: string | null;
    heir: AccountHeir | null;
  }>({
    queryKey: ["/api/account/settings"],
    enabled: !!user,
  });

  const { data: heir, isLoading: heirLoading } = useQuery<AccountHeir | null>({
    queryKey: ["/api/account/heir"],
    enabled: !!user,
  });

  useEffect(() => {
    if (heir) {
      setHeirName(heir.heirName);
      setHeirEmail(heir.heirEmail);
      setRelationship(heir.relationship || "");
      setNotes(heir.notes || "");
      setInactivityMonths(heir.inactivityMonths || "6");
    }
  }, [heir]);

  const saveHeirMutation = useMutation({
    mutationFn: async (data: { heirName: string; heirEmail: string; relationship?: string; notes?: string; inactivityMonths?: string }) => {
      return apiRequest("POST", "/api/account/heir", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/account/heir"] });
      queryClient.invalidateQueries({ queryKey: ["/api/account/settings"] });
      toast({
        title: "Heir Designation Saved",
        description: "Your account heir has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save heir designation",
        variant: "destructive",
      });
    },
  });

  const deleteHeirMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", "/api/account/heir", undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/account/heir"] });
      queryClient.invalidateQueries({ queryKey: ["/api/account/settings"] });
      setHeirName("");
      setHeirEmail("");
      setRelationship("");
      setNotes("");
      setInactivityMonths("6");
      toast({
        title: "Heir Designation Removed",
        description: "Your account heir has been removed.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove heir designation",
        variant: "destructive",
      });
    },
  });

  const handleSaveHeir = () => {
    if (!heirName.trim() || !heirEmail.trim()) {
      toast({
        title: "Required Fields",
        description: "Please enter the heir's name and email address.",
        variant: "destructive",
      });
      return;
    }

    saveHeirMutation.mutate({
      heirName: heirName.trim(),
      heirEmail: heirEmail.trim(),
      relationship: relationship.trim() || undefined,
      notes: notes.trim() || undefined,
      inactivityMonths,
    });
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    navigate("/");
    return null;
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/dashboard")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="font-semibold">Account Settings</h1>
        </div>
      </header>

      <main className="container py-8 max-w-3xl">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Account Information
              </CardTitle>
              <CardDescription>
                Your profile and activity information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-muted-foreground">Name</Label>
                  <p className="font-medium" data-testid="text-user-name">
                    {user.firstName} {user.lastName}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Email</Label>
                  <p className="font-medium" data-testid="text-user-email">
                    {user.email || "Not set"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Last activity: {formatDate(accountSettings?.lastActivityAt || null)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Account Heir (Deadman Switch)
              </CardTitle>
              <CardDescription>
                Designate someone to inherit your family trees if you become inactive for an extended period. 
                After {inactivityMonths} months of no activity, they'll receive an email with access to your trees.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {accountSettings?.inactivityReminderSentAt && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Inactivity Warning Sent</AlertTitle>
                  <AlertDescription>
                    An inactivity reminder was sent on {formatDate(accountSettings.inactivityReminderSentAt)}. 
                    Log in regularly to prevent account transfer to your designated heir.
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="heirName">Heir's Full Name *</Label>
                    <Input
                      id="heirName"
                      placeholder="Enter heir's name"
                      value={heirName}
                      onChange={(e) => setHeirName(e.target.value)}
                      data-testid="input-heir-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="heirEmail">Heir's Email Address *</Label>
                    <Input
                      id="heirEmail"
                      type="email"
                      placeholder="Enter heir's email"
                      value={heirEmail}
                      onChange={(e) => setHeirEmail(e.target.value)}
                      data-testid="input-heir-email"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="relationship">Relationship to You</Label>
                    <Select value={relationship} onValueChange={setRelationship}>
                      <SelectTrigger id="relationship" data-testid="select-relationship">
                        <SelectValue placeholder="Select relationship" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="spouse">Spouse</SelectItem>
                        <SelectItem value="child">Child</SelectItem>
                        <SelectItem value="sibling">Sibling</SelectItem>
                        <SelectItem value="parent">Parent</SelectItem>
                        <SelectItem value="grandchild">Grandchild</SelectItem>
                        <SelectItem value="niece_nephew">Niece/Nephew</SelectItem>
                        <SelectItem value="cousin">Cousin</SelectItem>
                        <SelectItem value="friend">Friend</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="inactivityMonths">Inactivity Period</Label>
                    <Select value={inactivityMonths} onValueChange={setInactivityMonths}>
                      <SelectTrigger id="inactivityMonths" data-testid="select-inactivity-months">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="6">6 months</SelectItem>
                        <SelectItem value="9">9 months</SelectItem>
                        <SelectItem value="12">12 months</SelectItem>
                        <SelectItem value="18">18 months</SelectItem>
                        <SelectItem value="24">24 months</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Additional Notes</Label>
                  <Textarea
                    id="notes"
                    placeholder="Any message or instructions for your heir..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    data-testid="input-heir-notes"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  onClick={handleSaveHeir}
                  disabled={saveHeirMutation.isPending}
                  data-testid="button-save-heir"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saveHeirMutation.isPending ? "Saving..." : (heir ? "Update Heir" : "Save Heir")}
                </Button>
                {heir && (
                  <Button
                    variant="outline"
                    onClick={() => deleteHeirMutation.mutate()}
                    disabled={deleteHeirMutation.isPending}
                    data-testid="button-delete-heir"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {deleteHeirMutation.isPending ? "Removing..." : "Remove Heir"}
                  </Button>
                )}
              </div>

              {heir && (
                <div className="text-sm text-muted-foreground pt-4 border-t">
                  <p>
                    <strong>How it works:</strong> If you don't log in for {inactivityMonths} months, 
                    we'll send you a reminder email. After 30 more days of inactivity, your account 
                    and all family trees will be transferred to {heir.heirName}.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
