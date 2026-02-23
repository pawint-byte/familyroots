import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { SEO } from "@/components/seo";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { Trees, Send, AlertCircle, CheckCircle2, UserPlus } from "lucide-react";
import { TREE_TYPE_CONFIGS, type TreeType } from "@shared/treeTypes";

interface ConnectInfo {
  treeId: string;
  treeName: string;
  treeType: string;
  ownerId: string;
  ownerFirstName: string;
  ownerLastName: string;
  ownerPhoto: string | null;
}

function getRelationshipOptions(treeType: string) {
  if (treeType === "family") {
    return [
      { value: "son", label: "Son" },
      { value: "daughter", label: "Daughter" },
      { value: "parent", label: "Parent" },
      { value: "spouse", label: "Spouse" },
      { value: "sibling", label: "Sibling" },
      { value: "grandparent", label: "Grandparent" },
      { value: "grandchild", label: "Grandchild" },
      { value: "aunt", label: "Aunt" },
      { value: "uncle", label: "Uncle" },
      { value: "niece", label: "Niece" },
      { value: "nephew", label: "Nephew" },
      { value: "cousin", label: "Cousin" },
      { value: "in_law", label: "In-Law" },
      { value: "step_relative", label: "Step-Relative" },
      { value: "other", label: "Other" },
    ];
  }
  const config = TREE_TYPE_CONFIGS[treeType as TreeType];
  if (!config) {
    return [{ value: "member", label: "Member" }, { value: "other", label: "Other" }];
  }
  return [
    ...config.defaultRelationshipTypes.map(r => ({ value: r.value, label: r.label })),
    { value: "other", label: "Other" },
  ];
}

export default function ConnectToTree() {
  const { treeId } = useParams<{ treeId: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [relationshipType, setRelationshipType] = useState("");
  const [customLabel, setCustomLabel] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  const { data: info, isLoading, error } = useQuery<ConnectInfo>({
    queryKey: ["/api/trees", treeId, "connect-info"],
    queryFn: async () => {
      const res = await fetch(`/api/trees/${treeId}/connect-info`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Tree not found");
      }
      return res.json();
    },
    enabled: !!treeId,
  });

  const sendRequest = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/user-connection-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          targetUserId: info!.ownerId,
          relationshipType,
          customLabel: relationshipType === "other" ? customLabel : undefined,
          message: message || undefined,
          targetTreeId: info!.treeId,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to send request");
      }
      return res.json();
    },
    onSuccess: () => {
      setSent(true);
      queryClient.invalidateQueries({ queryKey: ["/api/user-connection-requests"] });
    },
    onError: (err: Error) => {
      toast({
        title: "Request Failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!relationshipType) {
      toast({
        title: "Select a role",
        description: "Please select how you connect to this group",
        variant: "destructive",
      });
      return;
    }
    if (relationshipType === "other" && !customLabel.trim()) {
      toast({
        title: "Describe your connection",
        description: "Please describe your relationship or role",
        variant: "destructive",
      });
      return;
    }
    sendRequest.mutate();
  };

  const treeTypeConfig = info ? TREE_TYPE_CONFIGS[info.treeType as TreeType] : null;
  const relationshipOptions = info ? getRelationshipOptions(info.treeType) : [];
  const isOwnTree = user && info && user.id === info.ownerId;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Skeleton className="h-16 w-16 rounded-full mx-auto mb-4" />
            <Skeleton className="h-6 w-48 mx-auto mb-2" />
            <Skeleton className="h-4 w-64 mx-auto" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <SEO title="Tree Not Found | FamilyRoots" description="This tree could not be found" />
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle className="font-serif">Tree Not Found</CardTitle>
            <CardDescription>
              {(error as Error).message || "This connection link is invalid or the tree no longer exists."}
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

  if (sent) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <SEO title="Request Sent | FamilyRoots" description="Your connection request has been sent" />
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle className="font-serif">Request Sent!</CardTitle>
            <CardDescription>
              Your connection request to <strong>{info?.treeName}</strong> has been sent to{" "}
              {info?.ownerFirstName}. They'll review and accept it shortly.
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
        title={`Connect to ${info?.treeName || "Tree"} | FamilyRoots`}
        description={`Join ${info?.treeName} on FamilyRoots`}
      />
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
            <Trees className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="font-serif text-2xl" data-testid="text-tree-name">
            {info?.treeName}
          </CardTitle>
          {treeTypeConfig && (
            <Badge variant="outline" className="mx-auto mt-1" data-testid="badge-tree-type">
              {treeTypeConfig.label}
            </Badge>
          )}
          <CardDescription className="mt-3">
            You've been invited to connect
          </CardDescription>

          <div className="flex items-center justify-center gap-3 mt-4 p-3 bg-muted rounded-lg">
            <Avatar className="h-10 w-10">
              <AvatarImage src={info?.ownerPhoto || undefined} />
              <AvatarFallback>
                {(info?.ownerFirstName?.[0] || "") + (info?.ownerLastName?.[0] || "")}
              </AvatarFallback>
            </Avatar>
            <div className="text-left">
              <p className="text-sm font-medium" data-testid="text-owner-name">
                {info?.ownerFirstName} {info?.ownerLastName}
              </p>
              <p className="text-xs text-muted-foreground">Owner</p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {!user ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                Sign in to send your connection request
              </p>
              <Button
                className="w-full"
                onClick={() => {
                  localStorage.setItem("pendingConnectRedirect", `/connect/${treeId}`);
                  navigate("/");
                }}
                data-testid="button-sign-in"
              >
                Sign In to Connect
              </Button>
            </div>
          ) : isOwnTree ? (
            <div className="text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                This is your own tree. Share this link with others so they can request to connect.
              </p>
              <Button
                variant="outline"
                onClick={() => navigate(`/tree/${treeId}`)}
                data-testid="button-go-to-tree"
              >
                Go to Tree
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="relationship-type">
                  {info?.treeType === "family" ? "I am their..." : "My role"}
                </Label>
                <Select value={relationshipType} onValueChange={setRelationshipType}>
                  <SelectTrigger id="relationship-type" data-testid="select-relationship-type">
                    <SelectValue placeholder={info?.treeType === "family" ? "Select your relationship" : "Select your role"} />
                  </SelectTrigger>
                  <SelectContent>
                    {relationshipOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} data-testid={`option-${opt.value}`}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {relationshipType === "other" && (
                <div className="space-y-2">
                  <Label htmlFor="custom-label">Describe your connection</Label>
                  <Input
                    id="custom-label"
                    value={customLabel}
                    onChange={(e) => setCustomLabel(e.target.value)}
                    placeholder="e.g., Godparent, Family friend..."
                    maxLength={100}
                    data-testid="input-custom-label"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="message">Message (optional)</Label>
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Add a note to your request..."
                  maxLength={500}
                  rows={2}
                  data-testid="input-message"
                />
              </div>

              <Button
                className="w-full"
                size="lg"
                onClick={handleSubmit}
                disabled={sendRequest.isPending}
                data-testid="button-send-request"
              >
                <Send className="h-4 w-4 mr-2" />
                {sendRequest.isPending ? "Sending..." : "Send Connection Request"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}