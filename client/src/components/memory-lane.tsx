import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useUpload } from "@/hooks/use-upload";
import { parseDateString } from "@/lib/utils";
import {
  BookHeart, Plus, Calendar, MapPin, Trash2, Image, Camera, Heart,
  MessageCircle, Star, Sparkles
} from "lucide-react";
import type { FamilyMember, Memory } from "@shared/schema";

interface MemoryLaneProps {
  treeId: string;
  members: FamilyMember[];
  canEdit: boolean;
}

interface MemoryWithMember extends Memory {
  member: FamilyMember | null;
}

const CATEGORIES = [
  { value: "memory", label: "Memory", icon: Heart },
  { value: "milestone", label: "Milestone", icon: Star },
  { value: "tradition", label: "Tradition", icon: Sparkles },
  { value: "funny", label: "Funny Moment", icon: MessageCircle },
  { value: "lesson", label: "Life Lesson", icon: BookHeart },
];

export function MemoryLane({ treeId, members, canEdit }: MemoryLaneProps) {
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [story, setStory] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [category, setCategory] = useState("memory");
  const [memberId, setMemberId] = useState<string>("");
  const [photoUrl, setPhotoUrl] = useState("");
  const { uploadFile, isUploading } = useUpload({
    onSuccess: (response) => {
      setPhotoUrl(response.objectPath);
    },
  });

  const { data: memoriesData, isLoading } = useQuery<MemoryWithMember[]>({
    queryKey: ['/api/trees', treeId, 'memories'],
    queryFn: async () => {
      const res = await fetch(`/api/trees/${treeId}/memories`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch memories');
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest(`/api/trees/${treeId}/memories`, {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trees', treeId, 'memories'] });
      setShowCreate(false);
      resetForm();
      toast({ title: "Memory saved", description: "Your memory has been added to the lane." });
    },
    onError: (err: any) => {
      if (err?.error === 'tier_limit_reached') {
        toast({ title: "Upload limit reached", description: err.message, variant: "destructive" });
      } else {
        toast({ title: "Error", description: "Failed to save memory", variant: "destructive" });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/memories/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trees', treeId, 'memories'] });
      toast({ title: "Memory removed" });
    },
  });

  const resetForm = () => {
    setTitle("");
    setStory("");
    setEventDate("");
    setCategory("memory");
    setMemberId("");
    setPhotoUrl("");
  };

  const handleSubmit = () => {
    if (!title.trim()) return;
    createMutation.mutate({
      title: title.trim(),
      story: story.trim() || null,
      eventDate: eventDate || null,
      category,
      memberId: memberId || null,
      photoUrl: photoUrl || null,
    });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadFile(file);
    }
  };

  const getCategoryConfig = (cat: string) => {
    return CATEGORIES.find(c => c.value === cat) || CATEGORIES[0];
  };

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case "memory": return "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300";
      case "milestone": return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
      case "tradition": return "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300";
      case "funny": return "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300";
      case "lesson": return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
      default: return "bg-muted text-muted-foreground";
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl space-y-4">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-48 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <BookHeart className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-serif font-bold" data-testid="text-memory-lane-title">Memory Lane</h2>
            <p className="text-sm text-muted-foreground">Stories, milestones, and moments worth remembering</p>
          </div>
        </div>
        {canEdit && (
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2" data-testid="button-add-memory">
                <Plus className="h-4 w-4" />
                Add Memory
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <BookHeart className="h-5 w-5 text-primary" />
                  Share a Memory
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Title</Label>
                  <Input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="What's this memory about?"
                    data-testid="input-memory-title"
                  />
                </div>
                <div>
                  <Label>Story</Label>
                  <Textarea
                    value={story}
                    onChange={e => setStory(e.target.value)}
                    placeholder="Tell the story..."
                    rows={4}
                    data-testid="input-memory-story"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Category</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger data-testid="select-memory-category">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map(c => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Date (optional)</Label>
                    <Input
                      type="date"
                      value={eventDate}
                      onChange={e => setEventDate(e.target.value)}
                      data-testid="input-memory-date"
                    />
                  </div>
                </div>
                <div>
                  <Label>About (optional)</Label>
                  <Select value={memberId} onValueChange={setMemberId}>
                    <SelectTrigger data-testid="select-memory-member">
                      <SelectValue placeholder="Link to a member" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No specific member</SelectItem>
                      {members.map(m => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.firstName} {m.lastName || ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Photo (optional)</Label>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 px-4 py-2 border rounded-lg cursor-pointer hover:bg-muted transition-colors">
                      <Camera className="h-4 w-4" />
                      <span className="text-sm">{isUploading ? "Uploading..." : photoUrl ? "Change Photo" : "Add Photo"}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handlePhotoUpload}
                        disabled={isUploading}
                        data-testid="input-memory-photo"
                      />
                    </label>
                    {photoUrl && (
                      <Badge variant="secondary" className="gap-1">
                        <Image className="h-3 w-3" />
                        Photo attached
                      </Badge>
                    )}
                  </div>
                </div>
                <Button
                  onClick={handleSubmit}
                  disabled={!title.trim() || createMutation.isPending}
                  className="w-full"
                  data-testid="button-save-memory"
                >
                  {createMutation.isPending ? "Saving..." : "Save Memory"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {(!memoriesData || memoriesData.length === 0) ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
            <BookHeart className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold mb-2" data-testid="text-no-memories">No Memories Yet</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            Start building your memory lane by sharing stories, milestones, and special moments from your family or group.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {memoriesData.map((mem) => {
            const catConfig = getCategoryConfig(mem.category || "memory");
            const CatIcon = catConfig.icon;
            const formattedDate = mem.eventDate ? (() => {
              const d = parseDateString(mem.eventDate);
              return d ? d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : mem.eventDate;
            })() : null;

            return (
              <Card key={mem.id} className="overflow-hidden hover:shadow-md transition-shadow" data-testid={`card-memory-${mem.id}`}>
                {mem.photoUrl && (
                  <div className="h-48 bg-muted overflow-hidden">
                    <img
                      src={mem.photoUrl.startsWith('/') ? mem.photoUrl : `/objects/${mem.photoUrl}`}
                      alt={mem.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <Badge variant="secondary" className={`gap-1 ${getCategoryColor(mem.category || "memory")}`}>
                          <CatIcon className="h-3 w-3" />
                          {catConfig.label}
                        </Badge>
                        {formattedDate && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formattedDate}
                          </span>
                        )}
                      </div>
                      <h3 className="font-semibold text-base mb-1">{mem.title}</h3>
                      {mem.story && (
                        <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{mem.story}</p>
                      )}
                      {mem.member && (
                        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={mem.member.photoUrl || undefined} />
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">
                              {mem.member.firstName[0]}{mem.member.lastName?.[0] || ""}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs text-muted-foreground">
                            About {mem.member.firstName} {mem.member.lastName || ""}
                          </span>
                        </div>
                      )}
                    </div>
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteMutation.mutate(mem.id)}
                        data-testid={`button-delete-memory-${mem.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-2">
                    {new Date(mem.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
