import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Plus, Calendar, MapPin, Image, Film, Trash2, Megaphone, Send } from "lucide-react";
import type { FamilyEvent, FamilyTree, EventMediaAttachment } from "@shared/schema";

interface LifeEventsSectionProps {
  memberId: string;
  treeId: string;
  canEdit: boolean;
  memberName: string;
}

const EVENT_TYPES = [
  { value: "birth", label: "Birth", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  { value: "death", label: "Death", color: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200" },
  { value: "marriage", label: "Marriage", color: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200" },
  { value: "divorce", label: "Divorce", color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200" },
  { value: "milestone", label: "Milestone", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  { value: "graduation", label: "Graduation", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
  { value: "achievement", label: "Achievement", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
];

export function LifeEventsSection({ memberId, treeId, canEdit, memberName }: LifeEventsSectionProps) {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);
  const [broadcastEvent, setBroadcastEvent] = useState<FamilyEvent | null>(null);
  const [selectedTreeIds, setSelectedTreeIds] = useState<string[]>([]);
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [eventType, setEventType] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");

  const { data: events = [], isLoading } = useQuery<FamilyEvent[]>({
    queryKey: ['/api/members', memberId, 'events'],
    enabled: !!memberId,
  });

  const createEventMutation = useMutation({
    mutationFn: async (eventData: any) => {
      return apiRequest('POST', `/api/trees/${treeId}/events`, eventData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/members', memberId, 'events'] });
      queryClient.invalidateQueries({ queryKey: ['/api/trees', treeId, 'events'] });
      setIsAddDialogOpen(false);
      resetForm();
      toast({ title: "Event added", description: "Life event has been recorded successfully." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to add event", variant: "destructive" });
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: async (eventId: string) => {
      return apiRequest('DELETE', `/api/trees/${treeId}/events/${eventId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/members', memberId, 'events'] });
      toast({ title: "Event deleted" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete event", variant: "destructive" });
    },
  });

  const { data: userTrees = [] } = useQuery<FamilyTree[]>({
    queryKey: ['/api/trees'],
  });

  const otherTrees = userTrees.filter(t => t.id !== treeId);

  const broadcastMutation = useMutation({
    mutationFn: async (data: { sourceTreeId: string; targetTreeIds: string[]; title: string; message: string; eventType: string; eventId?: string }) => {
      return apiRequest('POST', '/api/announcements/broadcast', data);
    },
    onSuccess: async (response) => {
      const result = await response.json();
      setIsBroadcastOpen(false);
      setBroadcastEvent(null);
      setSelectedTreeIds([]);
      setBroadcastMessage("");
      toast({
        title: "Announcement sent",
        description: `Broadcast to ${result.targetTreeIds?.length || 0} group(s). ${result.emailsSent || 0} email(s) sent.`,
      });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to broadcast", variant: "destructive" });
    },
  });

  const handleBroadcast = () => {
    if (!broadcastEvent || selectedTreeIds.length === 0) return;
    broadcastMutation.mutate({
      sourceTreeId: treeId,
      targetTreeIds: selectedTreeIds,
      title: broadcastEvent.title,
      message: broadcastMessage || broadcastEvent.description || "",
      eventType: broadcastEvent.eventType,
      eventId: broadcastEvent.id,
    });
  };

  const openBroadcast = (event: FamilyEvent) => {
    setBroadcastEvent(event);
    setSelectedTreeIds([]);
    setBroadcastMessage(event.description || "");
    setIsBroadcastOpen(true);
  };

  const toggleTreeSelection = (id: string) => {
    setSelectedTreeIds(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  };

  const resetForm = () => {
    setEventType("");
    setEventDate("");
    setTitle("");
    setDescription("");
    setLocation("");
  };

  const handleSubmit = () => {
    if (!eventType || !eventDate || !title) {
      toast({ title: "Missing fields", description: "Please fill in event type, date, and title", variant: "destructive" });
      return;
    }

    createEventMutation.mutate({
      memberId,
      eventType,
      eventDate,
      title,
      description: description || undefined,
      location: location || undefined,
      mediaAttachments: [],
    });
  };

  const getEventTypeConfig = (type: string) => {
    return EVENT_TYPES.find(et => et.value === type) || EVENT_TYPES[4];
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Life Events</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-12 bg-muted rounded" />
            <div className="h-12 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <CardTitle className="text-lg">Life Events</CardTitle>
        {canEdit && (
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" data-testid="button-add-life-event">
                <Plus className="h-4 w-4 mr-1" />
                Add Event
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Record Life Event for {memberName}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="event-type">Event Type</Label>
                  <Select value={eventType} onValueChange={setEventType}>
                    <SelectTrigger data-testid="select-event-type">
                      <SelectValue placeholder="Select event type" />
                    </SelectTrigger>
                    <SelectContent>
                      {EVENT_TYPES.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="event-date">Date</Label>
                  <Input
                    id="event-date"
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    data-testid="input-event-date"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="event-title">Title</Label>
                  <Input
                    id="event-title"
                    placeholder="e.g., Wedding Ceremony, First Day of School"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    data-testid="input-event-title"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="event-location">Location (optional)</Label>
                  <Input
                    id="event-location"
                    placeholder="e.g., New York, NY"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    data-testid="input-event-location"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="event-description">Description (optional)</Label>
                  <Textarea
                    id="event-description"
                    placeholder="Add details about this event..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    data-testid="input-event-description"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleSubmit} 
                  disabled={createEventMutation.isPending}
                  data-testid="button-save-event"
                >
                  {createEventMutation.isPending ? "Saving..." : "Save Event"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No life events recorded yet</p>
            {canEdit && <p className="text-xs mt-1">Click "Add Event" to record important moments</p>}
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((event) => {
              const typeConfig = getEventTypeConfig(event.eventType);
              return (
                <div 
                  key={event.id} 
                  className="flex items-start gap-3 p-3 rounded-lg border bg-card"
                  data-testid={`event-item-${event.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Badge className={typeConfig.color} variant="secondary">
                        {typeConfig.label}
                      </Badge>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(event.eventDate)}
                      </span>
                    </div>
                    <h4 className="font-medium text-sm">{event.title}</h4>
                    {event.location && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <MapPin className="h-3 w-3" />
                        {event.location}
                      </p>
                    )}
                    {event.description && (
                      <p className="text-sm text-muted-foreground mt-1">{event.description}</p>
                    )}
                    {event.mediaAttachments && event.mediaAttachments.length > 0 && (
                      <div className="flex items-center gap-2 mt-2">
                        {event.mediaAttachments.filter((m: EventMediaAttachment) => m.type === 'image').length > 0 && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Image className="h-3 w-3" />
                            {event.mediaAttachments.filter((m: EventMediaAttachment) => m.type === 'image').length} photos
                          </span>
                        )}
                        {event.mediaAttachments.filter((m: EventMediaAttachment) => m.type === 'video').length > 0 && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Film className="h-3 w-3" />
                            {event.mediaAttachments.filter((m: EventMediaAttachment) => m.type === 'video').length} videos
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    {canEdit && otherTrees.length > 0 && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => openBroadcast(event)}
                        data-testid={`button-broadcast-event-${event.id}`}
                      >
                        <Megaphone className="h-4 w-4" />
                      </Button>
                    )}
                    {canEdit && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteEventMutation.mutate(event.id)}
                        data-testid={`button-delete-event-${event.id}`}
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

      <Dialog open={isBroadcastOpen} onOpenChange={setIsBroadcastOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Megaphone className="h-5 w-5" />
              Broadcast Announcement
            </DialogTitle>
          </DialogHeader>
          {broadcastEvent && (
            <div className="space-y-4 py-2">
              <div className="p-3 rounded-md border bg-muted/50">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="secondary" className={getEventTypeConfig(broadcastEvent.eventType).color}>
                    {getEventTypeConfig(broadcastEvent.eventType).label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{formatDate(broadcastEvent.eventDate)}</span>
                </div>
                <p className="font-medium text-sm">{broadcastEvent.title}</p>
              </div>

              <div className="space-y-2">
                <Label>Select groups to notify</Label>
                {otherTrees.length === 0 ? (
                  <p className="text-sm text-muted-foreground">You don't have any other trees to broadcast to.</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {otherTrees.map(tree => (
                      <label
                        key={tree.id}
                        className="flex items-center gap-3 p-2 rounded-md border cursor-pointer hover-elevate"
                        data-testid={`checkbox-tree-${tree.id}`}
                      >
                        <Checkbox
                          checked={selectedTreeIds.includes(tree.id)}
                          onCheckedChange={() => toggleTreeSelection(tree.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{tree.name}</p>
                          <p className="text-xs text-muted-foreground capitalize">{tree.treeType || "family"}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="broadcast-message">Message (optional)</Label>
                <Textarea
                  id="broadcast-message"
                  placeholder="Add a personal message to go with this announcement..."
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  rows={3}
                  data-testid="input-broadcast-message"
                />
              </div>

              {selectedTreeIds.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Members of {selectedTreeIds.length} selected group(s) who have notifications enabled will receive an email.
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBroadcastOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleBroadcast}
              disabled={broadcastMutation.isPending || selectedTreeIds.length === 0}
              data-testid="button-send-broadcast"
            >
              <Send className="h-4 w-4 mr-1" />
              {broadcastMutation.isPending ? "Sending..." : "Send Broadcast"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
