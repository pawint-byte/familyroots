import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Users, ArrowRight, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface MemberProfile {
  memberId: string;
  firstName: string | null;
  lastName: string | null;
  photoUrl: string | null;
  treeName: string | null;
  treeId: string;
}

interface UserConnection {
  id: string;
  userId1: string;
  userId2: string;
  relationshipFromUser1: string | null;
  relationshipFromUser2: string | null;
  createdAt: string;
  otherUser: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
  } | null;
  memberProfiles?: MemberProfile[];
  myRelationshipToThem: string | null;
  theirRelationshipToMe: string | null;
}

const RELATIONSHIP_LABELS: Record<string, string> = {
  son: "Son",
  daughter: "Daughter",
  parent: "Parent",
  spouse: "Spouse",
  sibling: "Sibling",
  grandparent: "Grandparent",
  grandchild: "Grandchild",
  aunt: "Aunt",
  uncle: "Uncle",
  niece: "Niece",
  nephew: "Nephew",
  cousin: "Cousin",
  in_law: "In-Law",
  step_relative: "Step-Relative",
  other: "Family",
};

export function MyConnectionsSection() {
  const { toast } = useToast();
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const { data: connections = [], isLoading } = useQuery<UserConnection[]>({
    queryKey: ["/api/user-connections"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (connectionId: string) => {
      await apiRequest("DELETE", `/api/user-connections/${connectionId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-connections"] });
      toast({ title: "Connection removed" });
      setDeleteTarget(null);
    },
    onError: () => {
      toast({ title: "Failed to remove connection", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-1" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg border">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24 mt-1" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (connections.length === 0) {
    return null;
  }

  return (
    <Card data-testid="my-connections-section">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">My Family Connections</CardTitle>
        </div>
        <CardDescription>
          Family members you're connected with on FamilyRoots
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {connections.map((connection) => {
            const otherUser = connection.otherUser;
            if (!otherUser) return null;

            const firstName = otherUser.firstName || "";
            const lastName = otherUser.lastName || "";
            const fullName = `${firstName} ${lastName}`.trim() || "Member";
            const initials = `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase() || '?';
            
            const myRelationship = connection.myRelationshipToThem 
              ? RELATIONSHIP_LABELS[connection.myRelationshipToThem] || connection.myRelationshipToThem
              : null;
            const theirRelationship = connection.theirRelationshipToMe
              ? RELATIONSHIP_LABELS[connection.theirRelationshipToMe] || connection.theirRelationshipToMe
              : null;

            const profiles = connection.memberProfiles || [];

            return (
              <div
                key={connection.id}
                className="flex items-center gap-3 p-4 rounded-lg border bg-card"
                data-testid={`connection-${connection.id}`}
              >
                <Link href={`/profile/${otherUser.id}`} className="flex items-center gap-3 flex-1 min-w-0 hover-elevate rounded-md p-1 -m-1">
                  <Avatar className="h-12 w-12 shrink-0">
                    <AvatarImage src={otherUser.profileImageUrl || undefined} />
                    <AvatarFallback className="bg-primary/10">{initials}</AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{fullName}</div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {theirRelationship && (
                        <Badge variant="secondary" className="text-xs">
                          Your {theirRelationship}
                        </Badge>
                      )}
                      {myRelationship && theirRelationship && myRelationship !== theirRelationship && (
                        <span className="text-xs text-muted-foreground">
                          (You're their {myRelationship})
                        </span>
                      )}
                      {!theirRelationship && myRelationship && (
                        <Badge variant="outline" className="text-xs">
                          You're their {myRelationship}
                        </Badge>
                      )}
                      {!theirRelationship && !myRelationship && (
                        <Badge variant="outline" className="text-xs">
                          Connected
                        </Badge>
                      )}
                    </div>
                    {profiles.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        {profiles.map((profile) => (
                          <Link
                            key={profile.treeId}
                            href={`/tree/${profile.treeId}`}
                            className="text-xs text-primary/70 hover:text-primary hover:underline"
                            onClick={(e) => e.stopPropagation()}
                            data-testid={`connection-tree-link-${profile.treeId}`}
                          >
                            {profile.treeName || "Tree"}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>

                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </Link>

                <Button
                  size="icon"
                  variant="ghost"
                  className="shrink-0 text-destructive hover:text-destructive"
                  onClick={() => setDeleteTarget({ id: connection.id, name: fullName })}
                  data-testid={`delete-connection-${connection.id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      </CardContent>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Connection</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove your connection with {deleteTarget?.name}? 
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
