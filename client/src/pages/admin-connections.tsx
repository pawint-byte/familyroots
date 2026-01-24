import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, Users, ArrowLeft, Trash2, Link2, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

interface UserConnection {
  id: string;
  userId1: string;
  userId2: string;
  relationshipFromUser1: string | null;
  relationshipFromUser2: string | null;
  connectedAt: string | null;
  user1: {
    id: string;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
  } | null;
  user2: {
    id: string;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
  } | null;
}

export default function AdminConnections() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<UserConnection | null>(null);

  const { data: isAdmin, isLoading: checkingAdmin } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["/api/admin/check"],
  });

  const { data: connections = [], isLoading, refetch } = useQuery<UserConnection[]>({
    queryKey: ["/api/admin/connections", search],
    queryFn: async () => {
      const url = search 
        ? `/api/admin/connections?search=${encodeURIComponent(search)}` 
        : "/api/admin/connections";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch connections");
      return res.json();
    },
    enabled: isAdmin?.isAdmin === true,
  });

  const deleteMutation = useMutation({
    mutationFn: async (connectionId: string) => {
      return apiRequest("DELETE", `/api/admin/connections/${connectionId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => query.queryKey[0] === "/api/admin/connections"
      });
      toast({ title: "Connection deleted" });
      setDeleteTarget(null);
    },
    onError: () => {
      toast({ title: "Failed to delete connection", variant: "destructive" });
    },
  });

  if (checkingAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin?.isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>You do not have admin privileges.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/">
              <Button variant="outline" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getUserName = (user: { firstName: string | null; lastName: string | null; email: string | null } | null) => {
    if (!user) return "Unknown User";
    const name = `${user.firstName || ""} ${user.lastName || ""}`.trim();
    return name || user.email || "Unknown";
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            <h1 className="font-serif text-xl font-semibold">Admin - User Connections</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              User Connections ({connections.length})
            </CardTitle>
            <CardDescription>
              View and manage all user-to-user family connections
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-6">
              <Input
                placeholder="Search by email or name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && refetch()}
                data-testid="input-search-connections"
              />
              <Button onClick={() => refetch()} variant="outline" data-testid="button-search">
                <Search className="h-4 w-4" />
              </Button>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : connections.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No user connections found
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User 1</TableHead>
                    <TableHead>Relationship</TableHead>
                    <TableHead>User 2</TableHead>
                    <TableHead>Relationship</TableHead>
                    <TableHead>Connected</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {connections.map((conn) => (
                    <TableRow key={conn.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{getUserName(conn.user1)}</div>
                          <div className="text-xs text-muted-foreground">{conn.user1?.email}</div>
                          <div className="text-xs text-muted-foreground">ID: {conn.userId1}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {conn.relationshipFromUser1 || "Not set"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{getUserName(conn.user2)}</div>
                          <div className="text-xs text-muted-foreground">{conn.user2?.email}</div>
                          <div className="text-xs text-muted-foreground">ID: {conn.userId2}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {conn.relationshipFromUser2 || "Not set"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {conn.connectedAt ? new Date(conn.connectedAt).toLocaleDateString() : "N/A"}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteTarget(conn)}
                          data-testid={`button-delete-${conn.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Connection?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the family connection between {getUserName(deleteTarget?.user1 || null)} and {getUserName(deleteTarget?.user2 || null)}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
