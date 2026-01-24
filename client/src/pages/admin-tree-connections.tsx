import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, ArrowLeft, Link2, TreeDeciduous, Mail, Trash2 } from "lucide-react";
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
import { ScrollArea } from "@/components/ui/scroll-area";

interface TreeConnectionWithDetails {
  id: string;
  tree1Id: string;
  tree2Id: string;
  connector1MemberId: string | null;
  connector2MemberId: string | null;
  connectionType: string;
  createdBy: string | null;
  createdAt: string;
  tree1: {
    id: string;
    name: string;
    ownerId: string;
    ownerEmail: string | null;
    ownerName: string | null;
  } | null;
  tree2: {
    id: string;
    name: string;
    ownerId: string;
    ownerEmail: string | null;
    ownerName: string | null;
  } | null;
}

export default function AdminTreeConnections() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<TreeConnectionWithDetails | null>(null);

  const { data: isAdmin, isLoading: checkingAdmin } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["/api/admin/check"],
  });

  const { data: connections = [], isLoading } = useQuery<TreeConnectionWithDetails[]>({
    queryKey: ["/api/admin/tree-connections", search],
    queryFn: async () => {
      const url = search 
        ? `/api/admin/tree-connections?search=${encodeURIComponent(search)}` 
        : "/api/admin/tree-connections";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch tree connections");
      return res.json();
    },
    enabled: isAdmin?.isAdmin === true,
  });

  if (checkingAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isAdmin?.isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Access Denied</CardTitle>
            <CardDescription>You don't have permission to access this page.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard">
              <Button variant="outline" className="w-full">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" data-testid="button-back">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
          <div className="flex-1" />
          <Badge variant="secondary" className="gap-1">
            <Link2 className="h-3 w-3" />
            {connections.length} Tree Connections
          </Badge>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TreeDeciduous className="h-5 w-5" />
              Admin - Tree Connections
            </CardTitle>
            <CardDescription>
              View all tree-to-tree connections that enable merged views. 
              These are created when users connect as family members.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-4">
              <Input
                placeholder="Search by tree name or owner email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-md"
                data-testid="input-search"
              />
              <Button variant="outline" onClick={() => setSearch("")} data-testid="button-clear">
                Clear
              </Button>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : connections.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {search ? "No tree connections found matching your search." : "No tree connections in the system."}
              </div>
            ) : (
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tree 1</TableHead>
                      <TableHead>Tree 2</TableHead>
                      <TableHead>Connection Type</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {connections.map((conn) => (
                      <TableRow key={conn.id} data-testid={`row-tree-connection-${conn.id}`}>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <TreeDeciduous className="h-4 w-4 text-primary" />
                              <span className="font-medium">{conn.tree1?.name || "Unknown Tree"}</span>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Mail className="h-3 w-3" />
                              {conn.tree1?.ownerEmail || "No email"}
                            </div>
                            {conn.tree1?.ownerName && (
                              <div className="text-xs text-muted-foreground">
                                {conn.tree1.ownerName}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <TreeDeciduous className="h-4 w-4 text-primary" />
                              <span className="font-medium">{conn.tree2?.name || "Unknown Tree"}</span>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Mail className="h-3 w-3" />
                              {conn.tree2?.ownerEmail || "No email"}
                            </div>
                            {conn.tree2?.ownerName && (
                              <div className="text-xs text-muted-foreground">
                                {conn.tree2.ownerName}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {conn.connectionType || "other"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {formatDate(conn.createdAt)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
