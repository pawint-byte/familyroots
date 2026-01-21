import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Plus, Edit, Trash2, Briefcase, MapPin, Trophy } from "lucide-react";
import type { CareerHistory } from "@shared/schema";

interface CareerHistoryProps {
  memberId: string;
  canEdit: boolean;
}

export function CareerHistorySection({ memberId, canEdit }: CareerHistoryProps) {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<CareerHistory | null>(null);

  const [formData, setFormData] = useState({
    employer: "",
    jobTitle: "",
    industry: "",
    startDate: "",
    endDate: "",
    isCurrent: false,
    location: "",
    achievements: "",
    notes: "",
  });

  const { data: careerHistory, isLoading } = useQuery<CareerHistory[]>({
    queryKey: ["/api/members", memberId, "career"],
    queryFn: async () => {
      const res = await fetch(`/api/members/${memberId}/career`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch career history");
      return res.json();
    },
  });

  const addMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", `/api/members/${memberId}/career`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/members", memberId, "career"] });
      setIsAddDialogOpen(false);
      resetForm();
      toast({ title: "Success", description: "Career record added" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add career record", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest("PATCH", `/api/members/${memberId}/career/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/members", memberId, "career"] });
      setEditingEntry(null);
      resetForm();
      toast({ title: "Success", description: "Career record updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update career record", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/members/${memberId}/career/${id}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/members", memberId, "career"] });
      toast({ title: "Success", description: "Career record deleted" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete career record", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      employer: "",
      jobTitle: "",
      industry: "",
      startDate: "",
      endDate: "",
      isCurrent: false,
      location: "",
      achievements: "",
      notes: "",
    });
  };

  const openEditDialog = (entry: CareerHistory) => {
    setEditingEntry(entry);
    setFormData({
      employer: entry.employer,
      jobTitle: entry.jobTitle || "",
      industry: entry.industry || "",
      startDate: entry.startDate || "",
      endDate: entry.endDate || "",
      isCurrent: entry.isCurrent || false,
      location: entry.location || "",
      achievements: entry.achievements || "",
      notes: entry.notes || "",
    });
  };

  const handleSubmit = () => {
    if (!formData.employer.trim()) {
      toast({ title: "Error", description: "Employer is required", variant: "destructive" });
      return;
    }

    const data = {
      employer: formData.employer,
      jobTitle: formData.jobTitle || null,
      industry: formData.industry || null,
      startDate: formData.startDate || null,
      endDate: formData.isCurrent ? null : (formData.endDate || null),
      isCurrent: formData.isCurrent,
      location: formData.location || null,
      achievements: formData.achievements || null,
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
    return new Date(dateStr).toLocaleDateString("en-US", { year: "numeric", month: "short" });
  };

  const formatDateRange = (start: string | null, end: string | null, isCurrent: boolean | null) => {
    const startFormatted = formatDate(start);
    const endFormatted = formatDate(end);
    if (startFormatted && isCurrent) return `${startFormatted} - Present`;
    if (startFormatted && endFormatted) return `${startFormatted} - ${endFormatted}`;
    if (startFormatted) return `Started ${startFormatted}`;
    if (endFormatted) return `Until ${endFormatted}`;
    return "";
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            Career
          </CardTitle>
        </CardHeader>
        <CardContent className="py-4">
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-4 bg-muted rounded w-1/2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="py-4">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              Career
            </CardTitle>
            {canEdit && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  resetForm();
                  setIsAddDialogOpen(true);
                }}
                data-testid="button-add-career"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="py-4 pt-0">
          {(!careerHistory || careerHistory.length === 0) ? (
            <p className="text-sm text-muted-foreground">No career records</p>
          ) : (
            <div className="space-y-4">
              {careerHistory.map((entry) => (
                <div
                  key={entry.id}
                  className="border-l-2 border-primary/20 pl-4 py-2"
                  data-testid={`career-entry-${entry.id}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{entry.employer}</span>
                        {entry.isCurrent && (
                          <Badge variant="default" className="text-xs">
                            Current
                          </Badge>
                        )}
                      </div>
                      {entry.jobTitle && (
                        <p className="text-sm text-muted-foreground">{entry.jobTitle}</p>
                      )}
                      {entry.industry && (
                        <p className="text-xs text-muted-foreground">{entry.industry}</p>
                      )}
                      {(entry.startDate || entry.endDate || entry.isCurrent) && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDateRange(entry.startDate, entry.endDate, entry.isCurrent)}
                        </p>
                      )}
                      {entry.location && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <MapPin className="h-3 w-3" />
                          {entry.location}
                        </p>
                      )}
                      {entry.achievements && (
                        <p className="text-xs text-primary mt-1 flex items-center gap-1">
                          <Trophy className="h-3 w-3" />
                          {entry.achievements}
                        </p>
                      )}
                      {entry.notes && (
                        <p className="text-xs text-muted-foreground mt-2 italic">{entry.notes}</p>
                      )}
                    </div>
                    {canEdit && (
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openEditDialog(entry)}
                          data-testid={`button-edit-career-${entry.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => deleteMutation.mutate(entry.id)}
                          data-testid={`button-delete-career-${entry.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isAddDialogOpen || !!editingEntry} onOpenChange={(open) => {
        if (!open) {
          setIsAddDialogOpen(false);
          setEditingEntry(null);
          resetForm();
        }
      }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingEntry ? "Edit Career" : "Add Career"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="employer">Employer / Company *</Label>
              <Input
                id="employer"
                value={formData.employer}
                onChange={(e) => setFormData({ ...formData, employer: e.target.value })}
                placeholder="Company or organization name"
                data-testid="input-career-employer"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="jobTitle">Job Title</Label>
                <Input
                  id="jobTitle"
                  value={formData.jobTitle}
                  onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                  placeholder="Manager, Engineer, Teacher"
                  data-testid="input-career-title"
                />
              </div>
              <div>
                <Label htmlFor="industry">Industry</Label>
                <Input
                  id="industry"
                  value={formData.industry}
                  onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                  placeholder="Technology, Healthcare"
                  data-testid="input-career-industry"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="isCurrent"
                checked={formData.isCurrent}
                onCheckedChange={(checked) => setFormData({ ...formData, isCurrent: checked })}
                data-testid="switch-career-current"
              />
              <Label htmlFor="isCurrent">Currently working here</Label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  data-testid="input-career-start-date"
                />
              </div>
              <div>
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  disabled={formData.isCurrent}
                  data-testid="input-career-end-date"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="City, State/Country or Remote"
                data-testid="input-career-location"
              />
            </div>

            <div>
              <Label htmlFor="achievements">Key Achievements</Label>
              <Textarea
                id="achievements"
                value={formData.achievements}
                onChange={(e) => setFormData({ ...formData, achievements: e.target.value })}
                placeholder="Promotions, awards, notable accomplishments"
                data-testid="input-career-achievements"
              />
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes about this position"
                data-testid="input-career-notes"
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
                disabled={addMutation.isPending || updateMutation.isPending}
                data-testid="button-save-career"
              >
                {addMutation.isPending || updateMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
