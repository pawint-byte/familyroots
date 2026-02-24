import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Mic, Square, Play, Pause, Trash2, Upload, Clock } from "lucide-react";
import type { VoiceNote } from "@shared/schema";

interface VoiceNotesSectionProps {
  memberId: string;
  treeId: string;
  canEdit: boolean;
  memberName: string;
}

interface VoiceNoteWithLock extends VoiceNote {
  locked?: boolean;
  lockReason?: string;
}

export function VoiceNotesSection({ memberId, treeId, canEdit, memberName }: VoiceNotesSectionProps) {
  const { toast } = useToast();
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [title, setTitle] = useState("");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const { data: notes, isLoading } = useQuery<VoiceNoteWithLock[]>({
    queryKey: ['/api/trees', treeId, 'members', memberId, 'voice-notes'],
    queryFn: async () => {
      const res = await fetch(`/api/trees/${treeId}/members/${memberId}/voice-notes`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch voice notes');
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async ({ audioUrl, durationSeconds, title }: { audioUrl: string; durationSeconds: number; title: string }) => {
      return apiRequest(`/api/trees/${treeId}/members/${memberId}/voice-notes`, {
        method: 'POST',
        body: JSON.stringify({ audioUrl, durationSeconds, title: title || `Voice note for ${memberName}` }),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trees', treeId, 'members', memberId, 'voice-notes'] });
      setRecordedBlob(null);
      setTitle("");
      setRecordingDuration(0);
      toast({ title: "Voice note saved" });
    },
    onError: (err: any) => {
      if (err?.error === 'tier_limit_reached') {
        toast({ title: "Upload limit reached", description: err.message, variant: "destructive" });
      } else {
        toast({ title: "Error", description: "Failed to save voice note", variant: "destructive" });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/voice-notes/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trees', treeId, 'members', memberId, 'voice-notes'] });
      toast({ title: "Voice note removed" });
    },
  });

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      setRecordingDuration(0);

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setRecordedBlob(blob);
        stream.getTracks().forEach(t => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);
      };

      recorder.start(100);
      setIsRecording(true);

      timerRef.current = setInterval(() => {
        setRecordingDuration(d => d + 1);
      }, 1000);
    } catch (err) {
      toast({ title: "Microphone access denied", description: "Please allow microphone access to record voice notes.", variant: "destructive" });
    }
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === "recording") {
      recorder.stop();
      setIsRecording(false);
    }
  };

  const uploadAndSave = async () => {
    if (!recordedBlob) return;

    try {
      const urlRes = await fetch("/api/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: `voice-note-${Date.now()}.webm`, size: recordedBlob.size, contentType: "audio/webm" }),
      });
      if (!urlRes.ok) throw new Error("Failed to get upload URL");
      const { uploadURL, objectPath } = await urlRes.json();

      await fetch(uploadURL, {
        method: "PUT",
        body: recordedBlob,
        headers: { "Content-Type": "audio/webm" },
      });

      createMutation.mutate({
        audioUrl: objectPath,
        durationSeconds: recordingDuration,
        title: title.trim() || `Voice note for ${memberName}`,
      });
    } catch (err) {
      toast({ title: "Upload failed", description: "Could not upload voice note", variant: "destructive" });
    }
  };

  const playNote = (note: VoiceNoteWithLock) => {
    if (note.locked || !note.audioUrl) return;

    if (playingId === note.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
    }

    const url = note.audioUrl.startsWith('/') ? note.audioUrl : `/objects/${note.audioUrl}`;
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.onended = () => setPlayingId(null);
    audio.play();
    setPlayingId(note.id);
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
        <Mic className="h-4 w-4" />
        Voice Notes
      </h4>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : (
        <>
          {notes && notes.length > 0 && (
            <div className="space-y-2">
              {notes.map(note => (
                <Card key={note.id} className="bg-muted/50" data-testid={`voice-note-${note.id}`}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-full shrink-0"
                      onClick={() => playNote(note)}
                      disabled={note.locked}
                      data-testid={`button-play-note-${note.id}`}
                    >
                      {note.locked ? (
                        <Mic className="h-4 w-4 text-muted-foreground" />
                      ) : playingId === note.id ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{note.title || "Voice Note"}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {note.durationSeconds && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDuration(note.durationSeconds)}
                          </span>
                        )}
                        <span>{new Date(note.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    {note.locked && (
                      <Badge variant="secondary" className="text-xs">Premium</Badge>
                    )}
                    {canEdit && !note.locked && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteMutation.mutate(note.id)}
                        data-testid={`button-delete-note-${note.id}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {canEdit && (
            <div className="space-y-2">
              {recordedBlob ? (
                <Card className="border-primary/30 bg-primary/5">
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Mic className="h-4 w-4 text-primary" />
                      <span className="font-medium">Recording ready</span>
                      <Badge variant="secondary">{formatDuration(recordingDuration)}</Badge>
                    </div>
                    <Input
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      placeholder="Give it a title (optional)"
                      className="h-8 text-sm"
                      data-testid="input-voice-note-title"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={uploadAndSave}
                        disabled={createMutation.isPending}
                        className="gap-1"
                        data-testid="button-save-voice-note"
                      >
                        <Upload className="h-3.5 w-3.5" />
                        {createMutation.isPending ? "Saving..." : "Save"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { setRecordedBlob(null); setRecordingDuration(0); }}
                        data-testid="button-discard-voice-note"
                      >
                        Discard
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Button
                  variant={isRecording ? "destructive" : "outline"}
                  size="sm"
                  className="gap-2 w-full"
                  onClick={isRecording ? stopRecording : startRecording}
                  data-testid="button-record-voice-note"
                >
                  {isRecording ? (
                    <>
                      <Square className="h-3.5 w-3.5" />
                      Stop Recording ({formatDuration(recordingDuration)})
                    </>
                  ) : (
                    <>
                      <Mic className="h-3.5 w-3.5" />
                      Record Voice Note
                    </>
                  )}
                </Button>
              )}
            </div>
          )}

          {(!notes || notes.length === 0) && !canEdit && (
            <p className="text-sm text-muted-foreground">No voice notes recorded yet.</p>
          )}
        </>
      )}
    </div>
  );
}
