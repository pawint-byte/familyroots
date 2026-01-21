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
import { Plus, Edit, Trash2, GraduationCap, MapPin, Award } from "lucide-react";
import type { EducationHistory } from "@shared/schema";

interface EducationHistoryProps {
  memberId: string;
  canEdit: boolean;
}

export function EducationHistorySection({ memberId, canEdit }: EducationHistoryProps) {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<EducationHistory | null>(null);

  const [formData, setFormData] = useState({
    institution: "",
    degree: "",
    fieldOfStudy: "",
    startDate: "",
    endDate: "",
    graduated: false,
    honors: "",
    location: "",
    notes: "",
  });

  const { data: educationHistory, isLoading } = useQuery<EducationHistory[]>({
    queryKey: ["/api/members", memberId, "education"],
    queryFn: async () => {
      const res = await fetch(`/api/members/${memberId}/education`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch education history");
      return res.json();
    },
  });

  const addMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", `/api/members/${memberId}/education`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/members", memberId, "education"] });
      setIsAddDialogOpen(false);
      resetForm();
      toast({ title: "Success", description: "Education record added" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add education record", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest("PATCH", `/api/members/${memberId}/education/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/members", memberId, "education"] });
      setEditingEntry(null);
      resetForm();
      toast({ title: "Success", description: "Education record updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update education record", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/members/${memberId}/education/${id}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/members", memberId, "education"] });
      toast({ title: "Success", description: "Education record deleted" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete education record", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      institution: "",
      degree: "",
      fieldOfStudy: "",
      startDate: "",
      endDate: "",
      graduated: false,
      honors: "",
      location: "",
      notes: "",
    });
  };

  const openEditDialog = (entry: EducationHistory) => {
    setEditingEntry(entry);
    setFormData({
      institution: entry.institution,
      degree: entry.degree || "",
      fieldOfStudy: entry.fieldOfStudy || "",
      startDate: entry.startDate || "",
      endDate: entry.endDate || "",
      graduated: entry.graduated || false,
      honors: entry.honors || "",
      location: entry.location || "",
      notes: entry.notes || "",
    });
  };

  const handleSubmit = () => {
    if (!formData.institution.trim()) {
      toast({ title: "Error", description: "Institution is required", variant: "destructive" });
      return;
    }

    const data = {
      institution: formData.institution,
      degree: formData.degree || null,
      fieldOfStudy: formData.fieldOfStudy || null,
      startDate: formData.startDate || null,
      endDate: formData.endDate || null,
      graduated: formData.graduated,
      honors: formData.honors || null,
      location: formData.location || null,
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

  const formatDateRange = (start: string | null, end: string | null) => {
    const startFormatted = formatDate(start);
    const endFormatted = formatDate(end);
    if (startFormatted && endFormatted) return `${startFormatted} - ${endFormatted}`;
    if (startFormatted) return `${startFormatted} - Present`;
    if (endFormatted) return `Graduated ${endFormatted}`;
    return "";
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-base flex items-center gap-2">
            <GraduationCap className="h-4 w-4" />
            Education
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
              <GraduationCap className="h-4 w-4" />
              Education
            </CardTitle>
            {canEdit && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  resetForm();
                  setIsAddDialogOpen(true);
                }}
                data-testid="button-add-education"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="py-4 pt-0">
          {(!educationHistory || educationHistory.length === 0) ? (
            <p className="text-sm text-muted-foreground">No education records</p>
          ) : (
            <div className="space-y-4">
              {educationHistory.map((entry) => (
                <div
                  key={entry.id}
                  className="border-l-2 border-primary/20 pl-4 py-2"
                  data-testid={`education-entry-${entry.id}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{entry.institution}</span>
                        {entry.graduated && (
                          <Badge variant="secondary" className="text-xs">
                            <Award className="h-3 w-3 mr-1" />
                            Graduated
                          </Badge>
                        )}
                      </div>
                      {(entry.degree || entry.fieldOfStudy) && (
                        <p className="text-sm text-muted-foreground">
                          {[entry.degree, entry.fieldOfStudy].filter(Boolean).join(" in ")}
                        </p>
                      )}
                      {(entry.startDate || entry.endDate) && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDateRange(entry.startDate, entry.endDate)}
                        </p>
                      )}
                      {entry.location && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <MapPin className="h-3 w-3" />
                          {entry.location}
                        </p>
                      )}
                      {entry.honors && (
                        <p className="text-xs text-primary mt-1">{entry.honors}</p>
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
                          data-testid={`button-edit-education-${entry.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => deleteMutation.mutate(entry.id)}
                          data-testid={`button-delete-education-${entry.id}`}
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
              {editingEntry ? "Edit Education" : "Add Education"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="institution">Institution *</Label>
              <Input
                id="institution"
                value={formData.institution}
                onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
                placeholder="University, College, or School"
                data-testid="input-education-institution"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="degree">Degree</Label>
                <Input
                  id="degree"
                  value={formData.degree}
                  onChange={(e) => setFormData({ ...formData, degree: e.target.value })}
                  placeholder="Bachelor's, Master's, PhD"
                  data-testid="input-education-degree"
                />
              </div>
              <div>
                <Label htmlFor="fieldOfStudy">Field of Study</Label>
                <Input
                  id="fieldOfStudy"
                  value={formData.fieldOfStudy}
                  onChange={(e) => setFormData({ ...formData, fieldOfStudy: e.target.value })}
                  placeholder="Computer Science, History"
                  data-testid="input-education-field"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  data-testid="input-education-start-date"
                />
              </div>
              <div>
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  data-testid="input-education-end-date"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="graduated"
                checked={formData.graduated}
                onCheckedChange={(checked) => setFormData({ ...formData, graduated: checked })}
                data-testid="switch-education-graduated"
              />
              <Label htmlFor="graduated">Graduated</Label>
            </div>

            <div>
              <Label htmlFor="honors">Honors / Awards</Label>
              <Input
                id="honors"
                value={formData.honors}
                onChange={(e) => setFormData({ ...formData, honors: e.target.value })}
                placeholder="Magna Cum Laude, Dean's List"
                data-testid="input-education-honors"
              />
            </div>

            <div>
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="City, State/Country"
                data-testid="input-education-location"
              />
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes about education"
                data-testid="input-education-notes"
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
                data-testid="button-save-education"
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
