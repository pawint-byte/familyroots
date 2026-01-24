import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, Search, Users, ArrowLeft, Trash2, ArrowRight, 
  Mail, Calendar, TreeDeciduous, AlertTriangle 
} from "lucide-react";
import { Link } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";

interface UserWithStats {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  createdAt: string | null;
  lastActivityAt: string | null;
  treeCount: number;
}

export default function AdminUsers() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserWithStats | null>(null);
  const [transferTargetId, setTransferTargetId] = useState("");
  const [transferSearch, setTransferSearch] = useState("");
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleSearch = () => {
    setDebouncedSearch(search);
  };

  const { data: isAdmin, isLoading: checkingAdmin } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["/api/admin/check"],
  });

  const { data: users = [], isLoading: loadingUsers, refetch } = useQuery<UserWithStats[]>({
    queryKey: ["/api/admin/users", debouncedSearch],
    queryFn: async () => {
      const url = debouncedSearch 
        ? `/api/admin/users?search=${encodeURIComponent(debouncedSearch)}` 
        : "/api/admin/users";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
    enabled: isAdmin?.isAdmin === true,
  });

  const transferMutation = useMutation({
    mutationFn: async ({ fromUserId, toUserId }: { fromUserId: string; toUserId: string }) => {
      return apiRequest("POST", `/api/admin/users/${fromUserId}/transfer/${toUserId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ 
        title: "Transfer Complete", 
        description: "All data has been transferred to the target account." 
      });
      setShowTransferDialog(false);
      setSelectedUser(null);
      setTransferTargetId("");
      setTransferSearch("");
    },
    onError: (error: Error) => {
      toast({ 
        title: "Transfer Failed", 
        description: error.message || "Could not transfer user data", 
        variant: "destructive" 
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest("DELETE", `/api/admin/users/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ 
        title: "User Deleted", 
        description: "The user account has been removed." 
      });
      setShowDeleteDialog(false);
      setSelectedUser(null);
    },
    onError: (error: Error) => {
      toast({ 
        title: "Delete Failed", 
        description: error.message || "Could not delete user", 
        variant: "destructive" 
      });
    },
  });

  if (checkingAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isAdmin?.isAdmin) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Access Denied
            </CardTitle>
            <CardDescription>
              You don't have permission to access the admin dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard">
              <Button data-testid="button-back-dashboard">
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
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const isAppleRelayEmail = (email: string | null) => {
    return email?.includes("@privaterelay.appleid.com") || false;
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-6">
        <Link href="/dashboard">
          <Button variant="ghost" size="sm" data-testid="button-back-dashboard">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Admin - User Management
          </CardTitle>
          <CardDescription>
            Search and manage user accounts. Transfer data between accounts or remove duplicate accounts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-6">
            <Input
              placeholder="Search by email or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="max-w-md"
              data-testid="input-user-search"
            />
            <Button onClick={handleSearch} data-testid="button-search-users">
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
            <Button 
              variant="outline" 
              onClick={() => { setSearch(""); setDebouncedSearch(""); }}
              data-testid="button-clear-search"
            >
              Clear
            </Button>
          </div>

          {loadingUsers ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {debouncedSearch ? "No users found matching your search." : "No users in the system."}
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Trees</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Last Active</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span className="font-mono text-sm truncate max-w-[200px]">
                            {user.email || "No email"}
                          </span>
                          {isAppleRelayEmail(user.email) && (
                            <Badge variant="secondary" className="text-xs">
                              Apple Relay
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {user.firstName || user.lastName 
                          ? `${user.firstName || ""} ${user.lastName || ""}`.trim()
                          : <span className="text-muted-foreground italic">No name</span>
                        }
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="gap-1">
                          <TreeDeciduous className="h-3 w-3" />
                          {user.treeCount}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {formatDate(user.createdAt)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {formatDate(user.lastActivityAt)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedUser(user);
                              setShowTransferDialog(true);
                            }}
                            data-testid={`button-transfer-${user.id}`}
                          >
                            <ArrowRight className="h-3 w-3 mr-1" />
                            Transfer
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              setSelectedUser(user);
                              setShowDeleteDialog(true);
                            }}
                            data-testid={`button-delete-${user.id}`}
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Dialog open={showTransferDialog} onOpenChange={(open) => {
        setShowTransferDialog(open);
        if (!open) {
          setTransferTargetId("");
          setTransferSearch("");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer User Data</DialogTitle>
            <DialogDescription>
              Transfer all trees, connections, and other data from this account to another account.
              This is useful when a user accidentally created a duplicate account.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <p className="text-sm font-medium mb-2">Source Account (data will be moved from):</p>
              <div className="p-3 bg-muted rounded-md">
                <p className="font-mono text-sm">{selectedUser?.email || "No email"}</p>
                <p className="text-sm text-muted-foreground">
                  {selectedUser?.firstName || ""} {selectedUser?.lastName || ""} 
                  - {selectedUser?.treeCount || 0} trees
                </p>
              </div>
            </div>
            
            <div>
              <p className="text-sm font-medium mb-2">Target Account (data will be moved to):</p>
              <Input
                placeholder="Search by email or name..."
                value={transferSearch}
                onChange={(e) => setTransferSearch(e.target.value)}
                className="mb-2"
                data-testid="input-transfer-search"
              />
              <select
                className="w-full p-3 border rounded-md bg-background"
                value={transferTargetId}
                onChange={(e) => setTransferTargetId(e.target.value)}
                data-testid="select-transfer-target"
              >
                <option value="">Select target user...</option>
                {users
                  .filter(u => u.id !== selectedUser?.id)
                  .filter(u => {
                    if (!transferSearch) return true;
                    const searchLower = transferSearch.toLowerCase();
                    return (
                      (u.email?.toLowerCase() || "").includes(searchLower) ||
                      (u.firstName?.toLowerCase() || "").includes(searchLower) ||
                      (u.lastName?.toLowerCase() || "").includes(searchLower)
                    );
                  })
                  .map(u => (
                    <option key={u.id} value={u.id}>
                      {u.email || "No email"} {u.firstName || u.lastName ? `(${u.firstName || ""} ${u.lastName || ""})`.trim() : ""}
                    </option>
                  ))
                }
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                Select the account to receive all data from the source account.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowTransferDialog(false)}
              data-testid="button-cancel-transfer"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedUser && transferTargetId) {
                  transferMutation.mutate({
                    fromUserId: selectedUser.id,
                    toUserId: transferTargetId,
                  });
                }
              }}
              disabled={!transferTargetId || transferMutation.isPending}
              data-testid="button-confirm-transfer"
            >
              {transferMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Transfer Data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete User Account
            </DialogTitle>
            <DialogDescription>
              This will permanently delete this user and ALL their data including family trees, connections, and membership. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <p className="font-mono text-sm">{selectedUser?.email || "No email"}</p>
              <p className="text-sm text-muted-foreground">
                {selectedUser?.firstName || ""} {selectedUser?.lastName || ""}
              </p>
              {selectedUser?.treeCount && selectedUser.treeCount > 0 && (
                <p className="text-sm text-destructive font-medium mt-2">
                  Warning: This user has {selectedUser.treeCount} family tree(s) that will be deleted!
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowDeleteDialog(false)}
              data-testid="button-cancel-delete"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (selectedUser) {
                  deleteMutation.mutate(selectedUser.id);
                }
              }}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Delete Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
