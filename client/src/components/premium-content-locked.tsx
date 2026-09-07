import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Lock, Video, Mic, Crown } from "lucide-react";

interface PremiumContentLockedProps {
  type: "video" | "voice_note" | "media";
  title?: string;
  thumbnailUrl?: string;
  isCreator?: boolean;
  compact?: boolean;
  onUpgrade?: () => void;
}

export function PremiumContentLocked({
  type,
  title,
  thumbnailUrl,
  isCreator = false,
  compact = false,
  onUpgrade,
}: PremiumContentLockedProps) {
  const [, navigate] = useLocation();

  const handleUpgrade = () => {
    if (onUpgrade) {
      onUpgrade();
    } else {
      navigate("/pricing");
    }
  };

  const typeLabels = {
    video: "Video",
    voice_note: "Voice Note",
    media: "Media",
  };

  const TypeIcon = type === "video" ? Video : type === "voice_note" ? Mic : Lock;

  if (compact) {
    return (
      <div
        className="flex items-center gap-2 p-2 rounded-md bg-muted/50 border border-dashed border-muted-foreground/30"
        data-testid={`locked-content-${type}`}
      >
        <div className="relative shrink-0">
          <TypeIcon className="h-4 w-4 text-muted-foreground" />
          <Lock className="h-2.5 w-2.5 absolute -bottom-0.5 -right-0.5 text-amber-500" />
        </div>
        <span className="text-xs text-muted-foreground truncate flex-1">
          {title || `${typeLabels[type]} locked`}
        </span>
        {isCreator && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-xs px-2 text-amber-600 hover:text-amber-700"
            onClick={handleUpgrade}
            data-testid="button-unlock-compact"
          >
            Unlock
          </Button>
        )}
      </div>
    );
  }

  return (
    <div
      className="relative rounded-lg overflow-hidden border border-dashed border-muted-foreground/30 bg-muted/30"
      data-testid={`locked-content-${type}`}
    >
      {thumbnailUrl ? (
        <div className="relative">
          <img
            src={thumbnailUrl}
            alt={title || "Locked content"}
            className="w-full h-48 object-cover filter grayscale opacity-40"
          />
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30">
            <div className="bg-white/90 dark:bg-gray-800/90 rounded-full p-3 mb-3 shadow-lg">
              <Lock className="h-6 w-6 text-amber-500" />
            </div>
            <p className="text-white text-sm font-medium text-center px-4 drop-shadow">
              {title || "Paid-Plan Content"}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-8 px-4">
          <div className="relative mb-3">
            <TypeIcon className="h-10 w-10 text-muted-foreground/40" />
            <div className="absolute -bottom-1 -right-1 bg-amber-100 dark:bg-amber-900/30 rounded-full p-1">
              <Lock className="h-3.5 w-3.5 text-amber-500" />
            </div>
          </div>
          <p className="text-sm font-medium text-muted-foreground mb-1">
            {title || `${typeLabels[type]} Locked`}
          </p>
        </div>
      )}

      <div className="p-3 border-t border-dashed border-muted-foreground/20">
        <p className="text-xs text-muted-foreground mb-2 text-center">
          {isCreator
            ? "Your subscription is no longer active. Resubscribe to unlock your paid-plan content."
            : "This content was created with a paid subscription that is no longer active."}
        </p>
        {isCreator && (
          <Button
            onClick={handleUpgrade}
            size="sm"
            className="w-full"
            data-testid="button-resubscribe-unlock"
          >
            <Crown className="h-3.5 w-3.5 mr-1.5" />
            Resubscribe to Unlock
          </Button>
        )}
      </div>
    </div>
  );
}
