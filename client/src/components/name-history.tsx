import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Plus, Edit, Trash2, Heart, Baby, Gavel, Users, FileText } from "lucide-react";
import type { NameHistory } from "@shared/schema";

interface NameHistoryProps {
  memberId: string;
  canEdit: boolean;
}

const reasonIcons: Record<string, any> = {
  birth: Baby,
  marriage: Heart,
  divorce: Gavel,
  adoption: Users,
  legal: FileText,
  other: FileText,
};

const reasonLabels: Record<string, string> = {
  birth: "Birth Name",
  marriage: "Marriage",
  divorce: "Divorce",
  adoption: "Adoption",
  legal: "Legal Change",
  other: "Other",
};

export function NameHistorySection({ memberId, canEdit }: NameHistoryProps) {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<NameHistory | null>(null);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    maidenName: "",
    reason: "birth" as "birth" | "marriage" | "divorce" | "adoption" | "legal" | "other",
    effectiveDate: "",
    endDate: "",
    notes: "",
  });

  const { data: nameHistory, isLoading } = useQuery<NameHistory[]>({
    queryKey: ["/api/members", memberId, "name-history"],
    queryFn: async () => {
      const res = await fetch(`/api/members/${memberId}/name-history`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch name history");
      return res.json();
    },
  });

  const addMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", `/api/members/${memberId}/name-history`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/members", memberId, "name-history"] });
      setIsAddDialogOpen(false);
      resetForm();
      toast({ title: "Success", description: "Name record added" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add name record", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest("PATCH", `/api/members/${memberId}/name-history/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/members", memberId, "name-history"] });
      setEditingEntry(null);
      resetForm();
      toast({ title: "Success", description: "Name record updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update name record", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/members/${memberId}/name-history/${id}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/members", memberId, "name-history"] });
      toast({ title: "Success", description: "Name record deleted" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete name record", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      firstName: "",
      lastName: "",
      maidenName: "",
      reason: "birth",
      effectiveDate: "",
      endDate: "",
      notes: "",
    });
  };

  const openEditDialog = (entry: NameHistory) => {
    setEditingEntry(entry);
    setFormData({
      firstName: entry.firstName,
      lastName: entry.lastName || "",
      maidenName: entry.maidenName || "",
      reason: entry.reason,
      effectiveDate: entry.effectiveDate || "",
      endDate: entry.endDate || "",
      notes: entry.notes || "",
    });
  };

  const handleSubmit = () => {
    const data = {
      firstName: formData.firstName,
      lastName: formData.lastName || null,
      maidenName: formData.maidenName || null,
      reason: formData.reason,
      effectiveDate: formData.effectiveDate || null,
      endDate: formData.endDate || null,
      notes: formData.notes || null,
    };

    if (editingEntry) {
      updateMutation.mutate({ id: editingEntry.id, data });
    } else {
      addMutation.mutate(data);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <Card className="mt-4">
      <CardHeader className="flex flex-row items-center justify-between py-3">
        <CardTitle className="text-base font-medium">Name History</CardTitle>
        {canEdit && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              resetForm();
              setIsAddDialogOpen(true);
            }}
            data-testid="button-add-name-history"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : !nameHistory?.length ? (
          <p className="text-sm text-muted-foreground">No name history recorded</p>
        ) : (
          <div className="space-y-2">
            {nameHistory.map((entry) => {
              const Icon = reasonIcons[entry.reason] || FileText;
              return (
                <div
                  key={entry.id}
                  className="flex items-start justify-between gap-2 p-3 bg-muted rounded-md"
                  data-testid={`name-history-entry-${entry.id}`}
                >
                  <div className="flex items-start gap-3">
                    <Icon className="h-5 w-5 mt-0.5 text-muted-foreground" />
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">
                          {entry.firstName} {entry.lastName}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {reasonLabels[entry.reason]}
                        </Badge>
                      </div>
                      {entry.maidenName && (
                        <p className="text-xs text-muted-foreground">
                          Maiden name: {entry.maidenName}
                        </p>
                      )}
                      {(entry.effectiveDate || entry.endDate) && (
                        <p className="text-xs text-muted-foreground">
                          {formatDate(entry.effectiveDate)}
                          {entry.endDate && ` - ${formatDate(entry.endDate)}`}
                        </p>
                      )}
                      {entry.notes && (
                        <p className="text-xs text-muted-foreground mt-1">{entry.notes}</p>
                      )}
                    </div>
                  </div>
                  {canEdit && (
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => openEditDialog(entry)}
                        data-testid={`button-edit-name-${entry.id}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => {
                          if (confirm("Delete this name record?")) {
                            deleteMutation.mutate(entry.id);
                          }
                        }}
                        data-testid={`button-delete-name-${entry.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <Dialog
        open={isAddDialogOpen || !!editingEntry}
        onOpenChange={(open) => {
          if (!open) {
            setIsAddDialogOpen(false);
            setEditingEntry(null);
            resetForm();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingEntry ? "Edit Name Record" : "Add Name Record"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  data-testid="input-name-first"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  data-testid="input-name-last"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="maidenName">Maiden Name (if applicable)</Label>
                <Input
                  id="maidenName"
                  value={formData.maidenName}
                  onChange={(e) => setFormData({ ...formData, maidenName: e.target.value })}
                  data-testid="input-maiden-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reason">Reason for Name</Label>
                <Select
                  value={formData.reason}
                  onValueChange={(v) => setFormData({ ...formData, reason: v as any })}
                >
                  <SelectTrigger data-testid="select-name-reason">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="birth">Birth Name</SelectItem>
                    <SelectItem value="marriage">Marriage</SelectItem>
                    <SelectItem value="divorce">Divorce</SelectItem>
                    <SelectItem value="adoption">Adoption</SelectItem>
                    <SelectItem value="legal">Legal Change</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="effectiveDate">Start Date</Label>
                <Input
                  id="effectiveDate"
                  type="date"
                  value={formData.effectiveDate}
                  onChange={(e) => setFormData({ ...formData, effectiveDate: e.target.value })}
                  data-testid="input-name-start-date"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date (if changed)</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  data-testid="input-name-end-date"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional details about this name..."
                data-testid="input-name-notes"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsAddDialogOpen(false);
                  setEditingEntry(null);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!formData.firstName || addMutation.isPending || updateMutation.isPending}
                data-testid="button-save-name-history"
              >
                {addMutation.isPending || updateMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
