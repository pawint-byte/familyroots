import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { SEO } from "@/components/seo";
import { Switch } from "@/components/ui/switch";
import { Gift, Plus, Calendar, ArrowLeft, ShoppingBag, ExternalLink, Trash2, Edit, Package, Bell } from "lucide-react";
import type { GiftRegistry, FamilyMember } from "@shared/schema";

interface EnrichedRegistry extends GiftRegistry {
  memberName: string;
  memberPhoto: string | null;
  itemCount: number;
  purchasedCount: number;
  progress: number;
}

const eventTypeLabels: Record<string, string> = {
  birthday: "Birthday",
  baby_shower: "Baby Shower",
  wedding: "Wedding",
  anniversary: "Anniversary",
  graduation: "Graduation",
  holiday: "Holiday",
  housewarming: "Housewarming",
  retirement: "Retirement",
  other: "Other",
};

export default function GiftRegistryPage() {
  const { treeId } = useParams<{ treeId: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [title, setTitle] = useState("");
  const [eventType, setEventType] = useState<string>("birthday");
  const [eventDate, setEventDate] = useState("");
  const [description, setDescription] = useState("");
  const [notifyMembers, setNotifyMembers] = useState(true);

  const { data: tree } = useQuery<{ id: string; name: string; ownerId: string }>({
    queryKey: ["/api/trees", treeId],
    enabled: !!treeId,
  });

  const { data: members } = useQuery<FamilyMember[]>({
    queryKey: ["/api/trees", treeId, "members"],
    enabled: !!treeId,
  });

  const { data: registries, isLoading } = useQuery<EnrichedRegistry[]>({
    queryKey: ["/api/trees", treeId, "registries"],
    enabled: !!treeId,
  });

  const createRegistryMutation = useMutation({
    mutationFn: async (data: { memberId: string; treeId: string; title: string; eventType: string; eventDate: string | null; description: string }) => {
      return apiRequest("POST", "/api/registries", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trees", treeId, "registries"] });
      setIsCreateDialogOpen(false);
      resetForm();
      toast({ title: "Registry created", description: "The gift registry has been created successfully." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create registry", variant: "destructive" });
    },
  });

  const deleteRegistryMutation = useMutation({
    mutationFn: async (registryId: string) => {
      return apiRequest("DELETE", `/api/registries/${registryId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trees", treeId, "registries"] });
      toast({ title: "Registry deleted", description: "The gift registry has been deleted." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete registry", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setSelectedMemberId("");
    setTitle("");
    setEventType("birthday");
    setEventDate("");
    setDescription("");
    setNotifyMembers(true);
  };

  const handleCreateRegistry = () => {
    if (!selectedMemberId || !title || !eventType) {
      toast({ title: "Missing fields", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }
    createRegistryMutation.mutate({
      memberId: selectedMemberId,
      treeId: treeId!,
      title,
      eventType,
      eventDate: eventDate || null,
      description,
      notifyMembers,
    });
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "No date set";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <SEO 
        title={`Gift Registries - ${tree?.name || "Family Tree"}`}
        description="Create and manage gift registries for birthdays, baby showers, weddings, and more."
      />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/tree/${treeId}`)} data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Gift className="h-6 w-6" />
              Gift Registries
            </h1>
            <p className="text-muted-foreground">{tree?.name}</p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-registry">
                <Plus className="h-4 w-4 mr-2" />
                Create Registry
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create Gift Registry</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="member">For Family Member *</Label>
                  <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
                    <SelectTrigger id="member" data-testid="select-member">
                      <SelectValue placeholder="Select a family member" />
                    </SelectTrigger>
                    <SelectContent>
                      {members?.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.firstName} {member.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="title">Registry Title *</Label>
                  <Input
                    id="title"
                    placeholder="e.g., Sarah's 5th Birthday"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    data-testid="input-registry-title"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="eventType">Event Type *</Label>
                  <Select value={eventType} onValueChange={setEventType}>
                    <SelectTrigger id="eventType" data-testid="select-event-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(eventTypeLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="eventDate">Event Date</Label>
                  <Input
                    id="eventDate"
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    data-testid="input-event-date"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Add any notes or details about the event..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    data-testid="input-description"
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <Label htmlFor="notify-toggle" className="text-sm font-medium cursor-pointer">Notify tree members</Label>
                      <p className="text-xs text-muted-foreground">Email everyone in this tree about the registry</p>
                    </div>
                  </div>
                  <Switch
                    id="notify-toggle"
                    checked={notifyMembers}
                    onCheckedChange={setNotifyMembers}
                    data-testid="switch-notify-members"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleCreateRegistry} disabled={createRegistryMutation.isPending} data-testid="button-submit-registry">
                  {createRegistryMutation.isPending ? "Creating..." : "Create Registry"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {registries && registries.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Gift className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Gift Registries Yet</h3>
              <p className="text-muted-foreground text-center mb-4">
                Create a registry for upcoming birthdays, baby showers, weddings, and more. Family members can see what gifts are needed and mark items as purchased.
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-create-first-registry">
                <Plus className="h-4 w-4 mr-2" />
                Create First Registry
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {registries?.map((registry) => (
              <Card key={registry.id} className="hover-elevate cursor-pointer" onClick={() => navigate(`/registry/${registry.id}`)} data-testid={`card-registry-${registry.id}`}>
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={registry.memberPhoto || undefined} />
                      <AvatarFallback>{registry.memberName.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold truncate">{registry.title}</h3>
                        <Badge variant="secondary">{eventTypeLabels[registry.eventType] || registry.eventType}</Badge>
                        {!registry.isActive && <Badge variant="outline">Closed</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        For {registry.memberName} • {formatDate(registry.eventDate)}
                      </p>
                      <div className="flex items-center gap-4">
                        <div className="flex-1 max-w-xs">
                          <div className="flex justify-between text-xs text-muted-foreground mb-1">
                            <span>{registry.purchasedCount} of {registry.itemCount} items purchased</span>
                            <span>{registry.progress}%</span>
                          </div>
                          <Progress value={registry.progress} className="h-2" />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm("Are you sure you want to delete this registry?")) {
                            deleteRegistryMutation.mutate(registry.id);
                          }
                        }}
                        data-testid={`button-delete-registry-${registry.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ShoppingBag className="h-5 w-5" />
              How Gift Registries Work
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p><strong>1. Create a Registry:</strong> Set up a registry for a family member's special event.</p>
            <p><strong>2. Add Items:</strong> Add gift ideas with links to online stores (like Amazon).</p>
            <p><strong>3. Share with Family:</strong> All tree collaborators can view the registry and see what's needed.</p>
            <p><strong>4. Mark as Purchased:</strong> Family members click "I'm getting this" to avoid duplicate gifts.</p>
            <p><strong>5. Track Progress:</strong> See how much of the registry has been fulfilled.</p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
