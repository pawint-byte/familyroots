import { useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Image, Film, Play } from "lucide-react";
import type { EventMediaAttachment } from "@shared/schema";

interface EventMediaDetailProps {
  title: string;
  date: string;
  description?: string | null;
  location?: string | null;
  attachments?: EventMediaAttachment[] | null;
  formatDate?: (date: string) => string;
  children?: ReactNode;
  className?: string;
}

const mediaUrl = (url: string) => url.startsWith("/") ? url : `/objects/${url}`;

export function EventMediaDetail({ title, date, description, location, attachments, formatDate, children, className = "" }: EventMediaDetailProps) {
  const [open, setOpen] = useState(false);
  const media = attachments ?? [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className={`block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${className}`} aria-label={`Open details for ${title}`}>
          {children || (
            <span className="flex items-center gap-1 text-xs text-primary">
              <Image className="h-3.5 w-3.5" />
              View event details
            </span>
          )}
          {media.length > 0 && (
            <span className="mt-3 flex flex-wrap gap-2" aria-label={`${media.length} event attachment${media.length === 1 ? "" : "s"}`}>
              {media.slice(0, 4).map((attachment, index) => (
                <span key={`${attachment.url}-${index}`} className="relative h-16 w-16 overflow-hidden rounded-md border bg-muted">
                  {attachment.type === "image" ? (
                    <img src={mediaUrl(attachment.url)} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full items-center justify-center text-muted-foreground"><Film className="h-5 w-5" /></span>
                  )}
                  {attachment.type === "video" && <span className="absolute inset-0 flex items-center justify-center bg-foreground/25 text-background"><Play className="h-5 w-5 fill-current" /></span>}
                </span>
              ))}
              {media.length > 4 && <span className="flex h-16 w-16 items-center justify-center rounded-md border bg-muted text-xs text-muted-foreground">+{media.length - 4}</span>}
            </span>
          )}
          <span className="sr-only">View event details and {media.length} attachment{media.length === 1 ? "" : "s"}</span>
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {formatDate ? formatDate(date) : new Date(date).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
            {location ? ` · ${location}` : ""}
          </p>
        </DialogHeader>
        {description && <p className="whitespace-pre-wrap text-sm leading-relaxed">{description}</p>}
        {media.length ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {media.map((attachment, index) => (
              <figure key={`${attachment.url}-${index}`} className="min-w-0 space-y-2">
                {attachment.type === "image" ? (
                  <img src={mediaUrl(attachment.url)} alt={attachment.caption || `${title} photo ${index + 1}`} className="max-h-[55vh] w-full rounded-md bg-muted object-contain" />
                ) : (
                  <video controls preload="metadata" className="max-h-[55vh] w-full rounded-md bg-black" src={mediaUrl(attachment.url)} aria-label={attachment.caption || `${title} video ${index + 1}`} />
                )}
                {attachment.caption && <figcaption className="text-sm text-muted-foreground">{attachment.caption}</figcaption>}
              </figure>
            ))}
          </div>
        ) : (
          <p className="rounded-md bg-muted/60 p-4 text-sm text-muted-foreground">No photos or videos are attached to this event.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}