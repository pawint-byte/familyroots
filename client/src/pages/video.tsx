import { useEffect } from "react";
import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, ExternalLink, Play } from "lucide-react";

interface PublicVideo {
  id: string;
  title: string;
  videoUrl: string;
  thumbnailUrl: string | null;
  destinationUrl: string;
  duration: string | null;
}

export default function VideoPage() {
  const [, params] = useRoute("/video/:id");
  const videoId = params?.id;

  const { data: video, isLoading, error } = useQuery<PublicVideo>({
    queryKey: ["/api/videos", videoId],
    enabled: !!videoId,
  });

  useEffect(() => {
    if (video) {
      document.title = `${video.title} | FamilyRoots`;
    }
  }, [video]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8 text-center max-w-md">
          <h1 className="text-2xl font-bold mb-2">Video Not Found</h1>
          <p className="text-muted-foreground mb-4">
            This video may have been removed or is not available.
          </p>
          <Button asChild>
            <a href="/">Go to Homepage</a>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-6">
          <div className="aspect-video rounded-lg overflow-hidden bg-black shadow-2xl">
            <video
              src={video.videoUrl}
              poster={video.thumbnailUrl || undefined}
              controls
              autoPlay
              className="w-full h-full object-contain"
              data-testid="video-player"
            >
              Your browser does not support the video tag.
            </video>
          </div>

          <div className="text-center space-y-4">
            <h1 className="text-2xl font-bold" data-testid="video-title">{video.title}</h1>
            
            <Button 
              size="lg" 
              className="gap-2"
              asChild
              data-testid="button-visit-site"
            >
              <a href={video.destinationUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-5 w-5" />
                Visit Site
              </a>
            </Button>
          </div>

          <div className="pt-8 border-t text-center">
            <p className="text-sm text-muted-foreground mb-2">Powered by</p>
            <a href="/" className="inline-flex items-center gap-2 text-primary font-semibold hover:underline">
              <Play className="h-4 w-4" />
              FamilyRoots
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
