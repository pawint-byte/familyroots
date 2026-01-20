import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Video, RefreshCw, Trash2, Share2, ArrowLeft, ExternalLink, Copy } from "lucide-react";
import { Link } from "wouter";
import type { GeneratedVideo } from "@shared/schema";

interface Avatar {
  avatar_id: string;
  avatar_name: string;
  preview_image_url?: string;
}

interface Voice {
  voice_id: string;
  name: string;
  language?: string;
}

export default function AdminVideos() {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [script, setScript] = useState("");
  const [avatarId, setAvatarId] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [backgroundUrl, setBackgroundUrl] = useState("");
  const [destinationUrl, setDestinationUrl] = useState("");
  const [blueskyMessage, setBlueskyMessage] = useState("");
  const [sharingVideoId, setSharingVideoId] = useState<string | null>(null);

  const { data: avatars = [], isLoading: loadingAvatars } = useQuery<Avatar[]>({
    queryKey: ["/api/admin/heygen/avatars"],
  });

  const { data: voices = [], isLoading: loadingVoices } = useQuery<Voice[]>({
    queryKey: ["/api/admin/heygen/voices"],
  });

  const { data: videos = [], isLoading: loadingVideos } = useQuery<GeneratedVideo[]>({
    queryKey: ["/api/admin/videos"],
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/admin/videos", { title, script, avatarId, voiceId, backgroundUrl, destinationUrl });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/videos"] });
      toast({ title: "Video generation started", description: "Your video is being processed." });
      setTitle("");
      setScript("");
      setBackgroundUrl("");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to generate video", variant: "destructive" });
    },
  });

  const syncMutation = useMutation({
    mutationFn: async (videoId: string) => {
      return apiRequest("POST", `/api/admin/videos/${videoId}/sync`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/videos"] });
      toast({ title: "Status synced" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (videoId: string) => {
      return apiRequest("DELETE", `/api/admin/videos/${videoId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/videos"] });
      toast({ title: "Video deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const shareMutation = useMutation({
    mutationFn: async ({ videoId, message }: { videoId: string; message: string }) => {
      return apiRequest("POST", `/api/admin/videos/${videoId}/share/bluesky`, { message });
    },
    onSuccess: () => {
      toast({ title: "Posted to Bluesky!" });
      setSharingVideoId(null);
      setBlueskyMessage("");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "default";
      case "processing": return "secondary";
      case "failed": return "destructive";
      default: return "outline";
    }
  };

  const copyVideoLink = (videoId: string) => {
    const url = `${window.location.origin}/video/${videoId}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copied!" });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon" data-testid="button-back-dashboard">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Video Generator</h1>
            <p className="text-muted-foreground">Create AI-powered videos with HeyGen</p>
          </div>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Video className="h-5 w-5" />
                Create New Video
              </CardTitle>
              <CardDescription>Generate an AI avatar video</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Video Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="My Family Tree Video"
                  data-testid="input-video-title"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="avatar">Avatar</Label>
                <Select value={avatarId} onValueChange={setAvatarId}>
                  <SelectTrigger data-testid="select-avatar">
                    <SelectValue placeholder={loadingAvatars ? "Loading..." : "Select avatar"} />
                  </SelectTrigger>
                  <SelectContent>
                    {avatars.map((avatar) => (
                      <SelectItem key={avatar.avatar_id} value={avatar.avatar_id}>
                        {avatar.avatar_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="voice">Voice</Label>
                <Select value={voiceId} onValueChange={setVoiceId}>
                  <SelectTrigger data-testid="select-voice">
                    <SelectValue placeholder={loadingVoices ? "Loading..." : "Select voice"} />
                  </SelectTrigger>
                  <SelectContent>
                    {voices.map((voice) => (
                      <SelectItem key={voice.voice_id} value={voice.voice_id}>
                        {voice.name} {voice.language && `(${voice.language})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="script">Script</Label>
                <Textarea
                  id="script"
                  value={script}
                  onChange={(e) => setScript(e.target.value)}
                  placeholder="Enter the text for the avatar to speak..."
                  rows={4}
                  data-testid="input-video-script"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="background">Background Image URL (optional)</Label>
                <Input
                  id="background"
                  value={backgroundUrl}
                  onChange={(e) => setBackgroundUrl(e.target.value)}
                  placeholder="https://example.com/background.jpg"
                  data-testid="input-background-url"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="destination">Destination URL</Label>
                <Input
                  id="destination"
                  value={destinationUrl}
                  onChange={(e) => setDestinationUrl(e.target.value)}
                  placeholder="https://yoursite.com/landing-page"
                  data-testid="input-destination-url"
                />
                <p className="text-xs text-muted-foreground">Where viewers go after watching</p>
              </div>

              <Button
                onClick={() => generateMutation.mutate()}
                disabled={!title || !script || !avatarId || !voiceId || !destinationUrl || generateMutation.isPending}
                className="w-full"
                data-testid="button-generate-video"
              >
                {generateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Generate Video
              </Button>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Your Videos</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/videos"] })}
                data-testid="button-refresh-videos"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>

            {loadingVideos ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : videos.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No videos yet. Create your first one!
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {videos.map((video) => (
                  <Card key={video.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium truncate">{video.title}</h3>
                            <Badge variant={getStatusColor(video.status)}>{video.status}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground truncate">{video.script.substring(0, 100)}...</p>
                          {video.errorMessage && (
                            <p className="text-sm text-destructive mt-1">{video.errorMessage}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {video.status === "processing" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => syncMutation.mutate(video.id)}
                              disabled={syncMutation.isPending}
                              data-testid={`button-sync-${video.id}`}
                            >
                              <RefreshCw className={`h-4 w-4 ${syncMutation.isPending ? "animate-spin" : ""}`} />
                            </Button>
                          )}
                          {video.status === "completed" && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => copyVideoLink(video.id)}
                                data-testid={`button-copy-link-${video.id}`}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                              <Link href={`/video/${video.id}`}>
                                <Button variant="ghost" size="icon" data-testid={`button-view-${video.id}`}>
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                              </Link>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setSharingVideoId(sharingVideoId === video.id ? null : video.id)}
                                data-testid={`button-share-${video.id}`}
                              >
                                <Share2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteMutation.mutate(video.id)}
                            disabled={deleteMutation.isPending}
                            data-testid={`button-delete-${video.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      {sharingVideoId === video.id && (
                        <div className="mt-4 pt-4 border-t space-y-3">
                          <Label>Bluesky Message</Label>
                          <Textarea
                            value={blueskyMessage}
                            onChange={(e) => setBlueskyMessage(e.target.value)}
                            placeholder="Write a message to post with your video..."
                            rows={2}
                            data-testid="input-bluesky-message"
                          />
                          <Button
                            onClick={() => shareMutation.mutate({ videoId: video.id, message: blueskyMessage })}
                            disabled={shareMutation.isPending}
                            className="w-full"
                            data-testid="button-post-bluesky"
                          >
                            {shareMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Post to Bluesky
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
