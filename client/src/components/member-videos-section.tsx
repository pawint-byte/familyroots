import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Video, Trash2, Upload, Clock, Film } from "lucide-react";
import { PremiumContentLocked } from "@/components/premium-content-locked";
import type { MemberVideo } from "@shared/schema";

interface MemberVideosSectionProps {
  memberId: string;
  treeId: string;
  canEdit: boolean;
  memberName: string;
}

interface MemberVideoWithLock extends MemberVideo {
  locked?: boolean;
  lockReason?: string;
}

const MAX_VIDEO_SIZE_MB = 100;

export function MemberVideosSection({ memberId, treeId, canEdit, memberName }: MemberVideosSectionProps) {
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { data: pricingStatus } = useQuery<any>({
    queryKey: ["/api/pricing/status"],
  });
  const userTier = pricingStatus?.featureTier || 'explorer';
  const isVoiceVideoLocked = userTier === 'explorer';

  const { data: videos, isLoading } = useQuery<MemberVideoWithLock[]>({
    queryKey: ['/api/trees', treeId, 'members', memberId, 'videos'],
    queryFn: async () => {
      const res = await fetch(`/api/trees/${treeId}/members/${memberId}/videos`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch videos');
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async ({ videoUrl, durationSeconds, title }: { videoUrl: string; durationSeconds: number; title: string }) => {
      const res = await apiRequest('POST', `/api/trees/${treeId}/members/${memberId}/videos`, {
        videoUrl,
        durationSeconds,
        title: title || `Video of ${memberName}`,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trees', treeId, 'members', memberId, 'videos'] });
      setSelectedFile(null);
      setTitle("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast({ title: "Video saved" });
    },
    onError: (err: any) => {
      if (err?.error === 'tier_limit_reached') {
        toast({ title: "Upload limit reached", description: err.message, variant: "destructive" });
      } else {
        toast({ title: "Error", description: "Failed to save video", variant: "destructive" });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/member-videos/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trees', treeId, 'members', memberId, 'videos'] });
      toast({ title: "Video removed" });
    },
  });

  const getVideoDuration = (file: File): Promise<number> => {
    return new Promise((resolve) => {
      const el = document.createElement('video');
      el.preload = 'metadata';
      el.onloadedmetadata = () => {
        URL.revokeObjectURL(el.src);
        resolve(Number.isFinite(el.duration) ? Math.round(el.duration) : 0);
      };
      el.onerror = () => resolve(0);
      el.src = URL.createObjectURL(file);
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      toast({ title: "Invalid file", description: "Please select a video file.", variant: "destructive" });
      return;
    }
    if (file.size > MAX_VIDEO_SIZE_MB * 1024 * 1024) {
      toast({ title: "File too large", description: `Videos must be under ${MAX_VIDEO_SIZE_MB}MB.`, variant: "destructive" });
      return;
    }
    setSelectedFile(file);
  };

  const uploadAndSave = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    try {
      const duration = await getVideoDuration(selectedFile);
      const ext = selectedFile.name.split('.').pop() || 'mp4';

      const urlRes = await fetch("/api/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: `member-video-${Date.now()}.${ext}`, size: selectedFile.size, contentType: selectedFile.type }),
      });
      if (!urlRes.ok) {
        const errData = await urlRes.json().catch(() => null);
        if (errData?.error === 'file_too_large') {
          toast({ title: "File too large", description: errData.message, variant: "destructive" });
          setIsUploading(false);
          return;
        }
        throw new Error("Failed to get upload URL");
      }
      const { uploadURL, objectPath } = await urlRes.json();

      await fetch(uploadURL, {
        method: "PUT",
        body: selectedFile,
        headers: { "Content-Type": selectedFile.type },
      });

      createMutation.mutate({
        videoUrl: objectPath,
        durationSeconds: duration,
        title: title.trim() || `Video of ${memberName}`,
      });
    } catch (err) {
      toast({ title: "Upload failed", description: "Could not upload video", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const resolveUrl = (url: string) => (url.startsWith('/') ? url : `/objects/${url}`);

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
        <Video className="h-4 w-4" />
        Videos
      </h4>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : (
        <>
          {videos && videos.length > 0 && (
            <div className="space-y-2">
              {videos.map(vid => (
                <Card key={vid.id} className="bg-muted/50" data-testid={`member-video-${vid.id}`}>
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{vid.title || "Video"}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {vid.durationSeconds ? (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDuration(vid.durationSeconds)}
                            </span>
                          ) : null}
                          <span>{new Date(vid.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      {vid.locked && (
                        <Badge variant="secondary" className="text-xs">Premium</Badge>
                      )}
                      {canEdit && !vid.locked && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => deleteMutation.mutate(vid.id)}
                          data-testid={`button-delete-video-${vid.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                    {vid.locked || !vid.videoUrl ? (
                      <div className="flex items-center justify-center gap-2 rounded-md bg-muted h-32 text-muted-foreground text-sm">
                        <Film className="h-4 w-4" />
                        Premium content
                      </div>
                    ) : (
                      <video
                        controls
                        preload="metadata"
                        className="w-full rounded-md max-h-72 bg-black"
                        src={resolveUrl(vid.videoUrl)}
                        data-testid={`video-player-${vid.id}`}
                      />
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {canEdit && isVoiceVideoLocked && (
            <PremiumContentLocked
              type="voice_note"
              title="Videos require a subscription"
              isCreator={canEdit}
              compact
            />
          )}

          {canEdit && !isVoiceVideoLocked && (
            <div className="space-y-2">
              {selectedFile ? (
                <Card className="border-primary/30 bg-primary/5">
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Film className="h-4 w-4 text-primary" />
                      <span className="font-medium truncate">{selectedFile.name}</span>
                      <Badge variant="secondary">{(selectedFile.size / (1024 * 1024)).toFixed(1)}MB</Badge>
                    </div>
                    <Input
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      placeholder="Give it a title (optional)"
                      className="h-8 text-sm"
                      data-testid="input-video-title"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={uploadAndSave}
                        disabled={isUploading || createMutation.isPending}
                        className="gap-1"
                        data-testid="button-save-video"
                      >
                        <Upload className="h-3.5 w-3.5" />
                        {isUploading || createMutation.isPending ? "Uploading..." : "Save"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                        data-testid="button-discard-video"
                      >
                        Discard
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={handleFileSelect}
                    data-testid="input-video-file"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 w-full"
                    onClick={() => fileInputRef.current?.click()}
                    data-testid="button-upload-video"
                  >
                    <Video className="h-3.5 w-3.5" />
                    Upload Video (max {MAX_VIDEO_SIZE_MB}MB)
                  </Button>
                </>
              )}
            </div>
          )}

          {(!videos || videos.length === 0) && !canEdit && (
            <p className="text-sm text-muted-foreground">No videos uploaded yet.</p>
          )}
        </>
      )}
    </div>
  );
}
