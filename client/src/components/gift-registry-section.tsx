import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Gift, Plus, ExternalLink, Trash2 } from "lucide-react";
import type { GiftRegistry } from "@shared/schema";

interface EnrichedRegistry extends GiftRegistry {
  memberName: string;
  memberPhoto: string | null;
  itemCount: number;
  purchasedCount: number;
  progress: number;
}

interface GiftRegistrySectionProps {
  memberId: string;
  treeId: string;
  canEdit: boolean;
  memberName: string;
}

const EVENT_TYPES = [
  { value: "birthday", label: "Birthday" },
  { value: "baby_shower", label: "Baby Shower" },
  { value: "wedding", label: "Wedding" },
  { value: "anniversary", label: "Anniversary" },
  { value: "graduation", label: "Graduation" },
  { value: "holiday", label: "Holiday" },
  { value: "housewarming", label: "Housewarming" },
  { value: "retirement", label: "Retirement" },
  { value: "other", label: "Other" },
];

export function GiftRegistrySection({ memberId, treeId, canEdit, memberName }: GiftRegistrySectionProps) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [eventType, setEventType] = useState("birthday");
  const [eventDate, setEventDate] = useState("");
  const [description, setDescription] = useState("");

  const { data: allRegistries = [], isLoading } = useQuery<EnrichedRegistry[]>({
    queryKey: ["/api/trees", treeId, "registries"],
    enabled: !!treeId,
  });

  const registries = allRegistries.filter(r => r.memberId === memberId);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/registries", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trees", treeId, "registries"] });
      setIsCreateOpen(false);
      setTitle("");
      setEventType("birthday");
      setEventDate("");
      setDescription("");
      toast({ title: "Registry created", description: "Gift registry has been created." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create registry", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (registryId: string) => {
      return apiRequest("DELETE", `/api/registries/${registryId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trees", treeId, "registries"] });
      toast({ title: "Registry deleted" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete registry", variant: "destructive" });
    },
  });

  const handleCreate = () => {
    if (!title) {
      toast({ title: "Missing title", description: "Please enter a title for the registry", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      memberId,
      treeId,
      title,
      eventType,
      eventDate: eventDate || null,
      description: description || null,
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Gift Registry</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-10 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Gift className="h-5 w-5" />
          Gift Registry
        </CardTitle>
        {canEdit && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsCreateOpen(true)}
            data-testid="button-create-registry"
          >
            <Plus className="h-4 w-4 mr-1" />
            Create
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {registries.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground">
            <Gift className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No gift registries yet</p>
            {canEdit && <p className="text-xs mt-1">Create a registry for birthdays, weddings, or other occasions</p>}
          </div>
        ) : (
          <div className="space-y-3">
            {registries.map((registry) => {
              const eventLabel = EVENT_TYPES.find(e => e.value === registry.eventType)?.label || registry.eventType;
              return (
                <div
                  key={registry.id}
                  className="flex items-start gap-3 p-3 rounded-lg border bg-card cursor-pointer hover-elevate"
                  onClick={() => navigate(`/registry/${registry.id}`)}
                  data-testid={`registry-item-${registry.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="font-medium text-sm">{registry.title}</p>
                      <Badge variant="secondary">{eventLabel}</Badge>
                    </div>
                    {registry.eventDate && (
                      <p className="text-xs text-muted-foreground mb-1">
                        {new Date(registry.eventDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                      </p>
                    )}
                    <div className="flex items-center gap-2">
                      <Progress value={registry.progress} className="h-1.5 flex-1" />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {registry.purchasedCount}/{registry.itemCount} items
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => navigate(`/registry/${registry.id}`)}
                      data-testid={`button-view-registry-${registry.id}`}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                    {canEdit && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteMutation.mutate(registry.id)}
                        data-testid={`button-delete-registry-${registry.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Gift Registry for {memberName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="registry-title">Title</Label>
              <Input
                id="registry-title"
                placeholder="e.g., Birthday Wishlist 2026"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                data-testid="input-registry-title"
              />
            </div>
            <div className="space-y-2">
              <Label>Event Type</Label>
              <Select value={eventType} onValueChange={setEventType}>
                <SelectTrigger data-testid="select-registry-event-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map(et => (
                    <SelectItem key={et.value} value={et.value}>{et.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="registry-date">Event Date (optional)</Label>
              <Input
                id="registry-date"
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                data-testid="input-registry-date"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="registry-description">Description (optional)</Label>
              <Textarea
                id="registry-description"
                placeholder="Add details about this registry..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                data-testid="input-registry-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)} data-testid="button-cancel-registry">Cancel</Button>
            <Button
              onClick={handleCreate}
              disabled={createMutation.isPending}
              data-testid="button-save-registry"
            >
              {createMutation.isPending ? "Creating..." : "Create Registry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
