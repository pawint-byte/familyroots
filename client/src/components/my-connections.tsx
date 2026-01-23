import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, ArrowRight } from "lucide-react";
import { Link } from "wouter";

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
  const { data: connections = [], isLoading } = useQuery<UserConnection[]>({
    queryKey: ["/api/user-connections"],
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
            const fullName = `${firstName} ${lastName}`.trim() || "Family Member";
            const initials = `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase() || '?';
            
            const myRelationship = connection.myRelationshipToThem 
              ? RELATIONSHIP_LABELS[connection.myRelationshipToThem] || connection.myRelationshipToThem
              : null;
            const theirRelationship = connection.theirRelationshipToMe
              ? RELATIONSHIP_LABELS[connection.theirRelationshipToMe] || connection.theirRelationshipToMe
              : null;

            return (
              <Link 
                key={connection.id} 
                href={`/profile/${otherUser.id}`}
                className="block"
              >
                <div
                  className="flex items-center gap-3 p-4 rounded-lg border bg-card hover-elevate cursor-pointer transition-colors"
                  data-testid={`connection-${connection.id}`}
                >
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
                  </div>

                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
