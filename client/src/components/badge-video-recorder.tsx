import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Camera, Check, Circle, Clock, RotateCcw, Square } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const MAX_DURATION_SECONDS = 5 * 60;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const EXPLAINER =
  "FamilyRoots will use your camera and microphone to record a video for your badge. Nothing is recorded until you press Start.";
const FALLBACK_NOTE = "Recording isn't available in this browser — upload a video file instead.";

type RecorderPhase =
  | "idle"
  | "explaining"
  | "requesting"
  | "live"
  | "recording"
  | "stopping"
  | "review"
  | "unavailable"
  | "error";

interface BadgeVideoRecorderProps {
  memberId: string;
  onUse: (file: File) => boolean;
}

function getSupportedMimeType(): string | null {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") return null;
  if (typeof MediaRecorder.isTypeSupported !== "function") return null;
  const candidates = ["video/webm;codecs=vp9", "video/webm", "video/mp4"];
  for (const mimeType of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(mimeType)) return mimeType;
    } catch {
      // Some older implementations expose the API but throw for particular MIME values.
    }
  }
  return null;
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function extensionForMime(mimeType: string): string {
  return mimeType.toLowerCase().includes("mp4") ? "mp4" : "webm";
}

export function BadgeVideoRecorder({ memberId, onUse }: BadgeVideoRecorderProps) {
  const mimeType = getSupportedMimeType();
  const supported =
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === "function" &&
    typeof MediaRecorder !== "undefined" &&
    !!mimeType;

  const [phase, setPhase] = useState<RecorderPhase>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [previewReady, setPreviewReady] = useState(false);
  const [previewMessage, setPreviewMessage] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const previewBlobRef = useRef<Blob | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const hardStopTimerRef = useRef<number | null>(null);
  const sessionRef = useRef(0);
  const recordingRef = useRef(0);
  const recordingStartedAtRef = useRef(0);
  const intentionalTrackStopRef = useRef(false);
  const stopRequestedRef = useRef(false);
  const useInProgressRef = useRef(false);
  const memberIdRef = useRef(memberId);
  const stopRecordingRef = useRef<() => void>(() => undefined);
  const requestCameraRef = useRef<() => Promise<void>>(async () => undefined);

  const clearTimers = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    if (hardStopTimerRef.current) window.clearTimeout(hardStopTimerRef.current);
    timerRef.current = null;
    hardStopTimerRef.current = null;
  };

  const revokePreview = () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    previewBlobRef.current = null;
    setPreviewUrl(null);
  };

  const stopCamera = () => {
    intentionalTrackStopRef.current = true;
    const stream = streamRef.current;
    streamRef.current = null;
    if (stream) {
      stream.getTracks().forEach(track => {
        track.onended = null;
        try {
          track.stop();
        } catch {
          // Continue releasing the rest of the tracks if one browser track has already ended.
        }
      });
    }
    setCameraStream(null);
    setPreviewReady(false);
    setPreviewMessage("");
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const releaseEverything = () => {
    sessionRef.current += 1;
    recordingRef.current += 1;
    stopRequestedRef.current = false;
    useInProgressRef.current = false;
    clearTimers();
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (recorder && recorder.state !== "inactive") {
      recorder.ondataavailable = null;
      recorder.onerror = null;
      recorder.onstop = null;
      try {
        recorder.stop();
      } catch {
        // The browser may already have stopped the recorder while tearing down.
      }
    }
    stopCamera();
    chunksRef.current = [];
    revokePreview();
    setElapsedSeconds(0);
  };

  const showCameraPreview = useCallback(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;
    // Set both attributes and properties before attaching the stream. WebKit
    // needs an explicitly muted, inline element for camera autoplay.
    video.muted = true;
    video.defaultMuted = true;
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    if (video.srcObject !== stream) video.srcObject = stream;
    const requestId = sessionRef.current;
    void video.play().catch(error => {
      if (requestId !== sessionRef.current || videoRef.current !== video) return;
      if (error instanceof DOMException && error.name === "AbortError") return;
      setPreviewMessage("The camera preview could not play. Tap Show camera to try again.");
    });
  }, []);

  // Conditional recorder screens can replace the video element while keeping
  // the same stream. Bind on mount as well as on a new camera stream.
  const attachCameraPreview = useCallback((video: HTMLVideoElement | null) => {
    videoRef.current = video;
    if (video) showCameraPreview();
  }, [showCameraPreview]);

  useEffect(() => {
    if (cameraStream && videoRef.current?.srcObject !== cameraStream) showCameraPreview();
  }, [cameraStream, showCameraPreview]);

  const confirmPreviewFrame = () => {
    const video = videoRef.current;
    if (video && !video.paused && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
      setPreviewReady(true);
      setPreviewMessage("");
    }
  };

  useEffect(() => {
    if (phase !== "explaining") return;
    let firstFrame = 0;
    let secondFrame = 0;
    firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        void requestCameraRef.current();
      });
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
    };
  }, [phase]);

  // Cleanup intentionally runs once for the lifetime of this recorder instance.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => {
    sessionRef.current += 1;
    recordingRef.current += 1;
    clearTimers();
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (recorder && recorder.state !== "inactive") {
      recorder.ondataavailable = null;
      recorder.onerror = null;
      recorder.onstop = null;
      try {
        recorder.stop();
      } catch {
        // Ignore stop races on unmount.
      }
    }
    const stream = streamRef.current;
    streamRef.current = null;
    if (stream) {
      stream.getTracks().forEach(track => {
        track.onended = null;
        try {
          track.stop();
        } catch {
          // Best-effort cleanup for every track.
        }
      });
    }
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    previewBlobRef.current = null;
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (memberIdRef.current === memberId) return;
    memberIdRef.current = memberId;
    releaseEverything();
    setErrorMessage("");
    setPhase("idle");
  }, [memberId]);

  async function requestCamera() {
    if (!supported) {
      setPhase("unavailable");
      return;
    }
    const requestId = ++sessionRef.current;
    setPhase("requesting");
    setErrorMessage("");
    setPreviewReady(false);
    setPreviewMessage("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (requestId !== sessionRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      if (!stream.getVideoTracks().some(track => track.readyState === "live" && track.enabled)) {
        stream.getTracks().forEach(track => track.stop());
        throw new DOMException("No active camera video track", "NotFoundError");
      }
      streamRef.current = stream;
      intentionalTrackStopRef.current = false;
      stream.getTracks().forEach(track => {
        track.onended = () => {
          if (requestId !== sessionRef.current || intentionalTrackStopRef.current) return;
          const activeRecorder = recorderRef.current;
          if (activeRecorder && activeRecorder.state !== "inactive") {
            stopRecordingRef.current();
          } else {
            stopCamera();
            setErrorMessage("Your camera or microphone stopped. Check the device and try recording again.");
            setPhase("error");
          }
        };
      });
      setCameraStream(stream);
      setPhase("live");
    } catch (error) {
      if (requestId !== sessionRef.current) return;
      const name = error instanceof DOMException ? error.name : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError") {
        stopCamera();
        setPhase("unavailable");
      } else {
        const message =
          name === "NotFoundError" || name === "DevicesNotFoundError"
            ? "No camera or microphone was found. Connect a device and try again."
            : name === "NotReadableError" || name === "TrackStartError"
              ? "Your camera or microphone is in use by another app. Close it and try again."
              : "The camera and microphone could not be started. Check your browser settings and try again.";
        setErrorMessage(message);
        setPhase("error");
      }
    }
  }
  requestCameraRef.current = requestCamera;

  function startRecording() {
    const stream = streamRef.current;
    if (!stream || !mimeType || phase !== "live" || recorderRef.current || !previewReady) return;
    showCameraPreview();
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType });
    } catch {
      stopCamera();
      setErrorMessage("Recording could not start in this browser. You can try again or upload a video file.");
      setPhase("error");
      return;
    }

    const recordingId = ++recordingRef.current;
    chunksRef.current = [];
    stopRequestedRef.current = false;
    setElapsedSeconds(0);
    recordingStartedAtRef.current = Date.now();
    recorderRef.current = recorder;
    recorder.ondataavailable = event => {
      if (recordingId !== recordingRef.current || event.data.size === 0) return;
      chunksRef.current.push(event.data);
      const size = chunksRef.current.reduce((total, chunk) => total + chunk.size, 0);
      if (size > MAX_VIDEO_BYTES) stopRecordingRef.current();
    };
    recorder.onerror = () => {
      if (recordingId !== recordingRef.current) return;
      recordingRef.current += 1;
      stopRequestedRef.current = false;
      clearTimers();
      recorderRef.current = null;
      recorder.ondataavailable = null;
      recorder.onstop = null;
      recorder.onerror = null;
      if (recorder.state !== "inactive") {
        try {
          recorder.stop();
        } catch {
          // Continue releasing camera tracks if the browser has already stopped.
        }
      }
      chunksRef.current = [];
      stopCamera();
      setErrorMessage("A recording error occurred. Retake the video or upload a file instead.");
      setPhase("error");
    };
    recorder.onstop = () => {
      if (recordingId !== recordingRef.current) return;
      clearTimers();
      stopRequestedRef.current = false;
      recorderRef.current = null;
      stopCamera();
      const actualMime = recorder.mimeType || mimeType;
      const blob = new Blob(chunksRef.current, { type: actualMime });
      chunksRef.current = [];
      setElapsedSeconds(Math.min(
        MAX_DURATION_SECONDS,
        Math.max(0, Math.floor((Date.now() - recordingStartedAtRef.current) / 1000)),
      ));
      if (!blob.size) {
        setErrorMessage("No video data was captured. Retake the video and try again.");
        setPhase("error");
        return;
      }
      try {
        revokePreview();
        const url = URL.createObjectURL(blob);
        previewBlobRef.current = blob;
        previewUrlRef.current = url;
        setPreviewUrl(url);
        setPhase("review");
      } catch {
        setErrorMessage("The video preview could not be created. Retake the video or upload a file instead.");
        setPhase("error");
      }
    };

    try {
      recorder.start(1000);
      setPhase("recording");
      timerRef.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - recordingStartedAtRef.current) / 1000);
        setElapsedSeconds(Math.min(elapsed, MAX_DURATION_SECONDS));
        if (elapsed >= MAX_DURATION_SECONDS) stopRecordingRef.current();
      }, 250);
      hardStopTimerRef.current = window.setTimeout(
        () => stopRecordingRef.current(),
        MAX_DURATION_SECONDS * 1000,
      );
    } catch {
      recordingRef.current += 1;
      recorderRef.current = null;
      recorder.ondataavailable = null;
      recorder.onerror = null;
      recorder.onstop = null;
      chunksRef.current = [];
      stopCamera();
      setErrorMessage("The browser could not begin recording. Try again or upload a video file.");
      setPhase("error");
    }
  }

  function stopRecording() {
    if (stopRequestedRef.current) return;
    clearTimers();
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    stopRequestedRef.current = true;
    setPhase("stopping");
    try {
      recorder.stop();
    } catch {
      recordingRef.current += 1;
      recorderRef.current = null;
      recorder.ondataavailable = null;
      recorder.onerror = null;
      recorder.onstop = null;
      chunksRef.current = [];
      stopCamera();
      setErrorMessage("The recording could not be finalized. Retake it or upload a video file.");
      setPhase("error");
    }
    stopCamera();
  }
  stopRecordingRef.current = stopRecording;

  function beginRetake() {
    releaseEverything();
    setErrorMessage("");
    setPhase("requesting");
    void requestCamera();
  }

  function cancel() {
    releaseEverything();
    setErrorMessage("");
    setPhase("idle");
  }

  function useVideo() {
    const blob = previewBlobRef.current;
    if (!blob || !previewUrlRef.current || !mimeType || useInProgressRef.current) return;
    useInProgressRef.current = true;
    try {
      const fileMime = blob.type || mimeType;
      const file = new File(
        [blob],
        `badge-video-${memberId}-${Date.now()}.${extensionForMime(fileMime)}`,
        { type: fileMime },
      );
      if (!onUse(file)) {
        useInProgressRef.current = false;
        return;
      }
      releaseEverything();
      setErrorMessage("");
      setPhase("idle");
    } catch {
      useInProgressRef.current = false;
      setErrorMessage("The preview could not be prepared. Retake the video or upload a file instead.");
      setPhase("error");
    }
  }

  if (!supported || phase === "unavailable") {
    return (
      <div className="flex min-w-0 flex-1 items-center">
        <p className="text-xs leading-snug text-muted-foreground">{FALLBACK_NOTE}</p>
      </div>
    );
  }

  return (
    <div className={phase === "idle" ? "min-w-[110px] flex-1 space-y-2" : "w-full min-w-0 space-y-2"}>
      {phase === "requesting" || phase === "live" ? (
        <p className="text-sm leading-relaxed">{EXPLAINER}</p>
      ) : null}
      {phase === "idle" ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full gap-2"
          onClick={() => {
            setErrorMessage("");
            setPhase("explaining");
          }}
          data-testid="button-record-video"
        >
          <Camera className="h-3.5 w-3.5" />
          Record video
        </Button>
      ) : null}

      {phase === "explaining" ? (
        <Card className="border-primary/25 bg-primary/5">
          <CardContent className="space-y-3 p-3">
            <p className="text-sm leading-relaxed">{EXPLAINER}</p>
            <p className="text-xs text-muted-foreground">Opening camera and microphone…</p>
            <Button type="button" size="sm" variant="outline" onClick={cancel}>Cancel</Button>
          </CardContent>
        </Card>
      ) : null}

      {phase === "requesting" ? (
        <Card className="border-primary/25 bg-primary/5" aria-live="polite">
          <CardContent className="flex items-center gap-3 p-3">
            <div className="h-4 w-4 animate-pulse rounded-full bg-primary/40" />
            <span className="text-sm text-muted-foreground">Connecting to your camera…</span>
            <Button type="button" size="sm" variant="ghost" className="ml-auto" onClick={cancel}>Cancel</Button>
          </CardContent>
        </Card>
      ) : null}

      {phase === "live" || phase === "recording" || phase === "stopping" ? (
        <Card className="overflow-hidden border-primary/25 bg-primary/5">
          <CardContent className="space-y-3 p-3">
            <div className="relative overflow-hidden rounded-md bg-slate-950">
              <video
                ref={attachCameraPreview}
                autoPlay
                muted
                playsInline
                onLoadedData={confirmPreviewFrame}
                onPlaying={confirmPreviewFrame}
                className="aspect-video w-full object-cover"
                aria-label="Live camera preview"
                data-testid="video-recording-preview"
              />
              {phase === "recording" || phase === "stopping" ? (
                <Badge className="absolute left-2 top-2 gap-1.5 bg-destructive text-destructive-foreground">
                  <Circle className="h-2.5 w-2.5 fill-current" />
                  {phase === "stopping" ? "Finishing" : "Recording"}
                </Badge>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 font-mono text-sm tabular-nums" aria-live="off">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                {formatTime(elapsedSeconds)}
                <span className="font-sans text-xs text-muted-foreground">/ 5:00</span>
              </span>
              <div className="flex gap-2">
                {phase === "live" ? (
                  <Button type="button" size="sm" onClick={startRecording} disabled={!previewReady} className="gap-1.5">
                    <Circle className="h-3 w-3 fill-current" />
                    Start
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={stopRecording}
                    disabled={phase === "stopping"}
                    className="gap-1.5"
                  >
                    <Square className="h-3 w-3 fill-current" />
                    {phase === "stopping" ? "Finishing…" : "Stop"}
                  </Button>
                )}
                <Button type="button" size="sm" variant="outline" onClick={beginRetake} className="gap-1.5">
                  <RotateCcw className="h-3.5 w-3.5" />
                  Retake
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={cancel}>Cancel</Button>
              </div>
            </div>
            {!previewReady || previewMessage ? (
              <div className="flex flex-wrap items-center gap-2" role="status">
                <p className="flex-1 text-xs text-muted-foreground">
                  {previewMessage || "Waiting for camera video before recording…"}
                </p>
                <Button type="button" size="sm" variant="outline" onClick={showCameraPreview}>
                  Show camera
                </Button>
              </div>
            ) : null}
            <p className="text-xs text-muted-foreground">Maximum recording time is 5 minutes.</p>
          </CardContent>
        </Card>
      ) : null}

      {phase === "review" ? (
        <Card className="overflow-hidden border-primary/25 bg-primary/5">
          <CardContent className="space-y-3 p-3">
            {previewUrl ? (
              <video
                controls
                playsInline
                preload="metadata"
                src={previewUrl}
                className="aspect-video w-full rounded-md bg-slate-950"
                aria-label="Recorded video preview"
                data-testid="video-recorded-review"
              />
            ) : null}
            {elapsedSeconds >= MAX_DURATION_SECONDS ? (
              <p className="text-xs text-muted-foreground">The 5-minute recording limit was reached.</p>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-sm tabular-nums">{formatTime(elapsedSeconds)} recorded</span>
              <div className="flex gap-2">
                <Button type="button" size="sm" onClick={useVideo} className="gap-1.5" data-testid="button-use-recorded-video">
                  <Check className="h-3.5 w-3.5" />
                  Use this video
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={beginRetake} className="gap-1.5">
                  <RotateCcw className="h-3.5 w-3.5" />
                  Retake
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={cancel}>Cancel</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {phase === "error" ? (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="space-y-3 p-3">
            <div className="flex items-start gap-2 text-sm">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <p>{errorMessage}</p>
            </div>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => {
                setErrorMessage("");
                setPhase("explaining");
              }}>
                Try again
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={cancel}>Close</Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
