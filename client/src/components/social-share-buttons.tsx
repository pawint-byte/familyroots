import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { 
  Share2, 
  Copy, 
  CheckCircle2, 
  MessageCircle, 
  Mail,
  Twitter,
  Facebook
} from "lucide-react";
import { SiWhatsapp, SiX } from "react-icons/si";

interface SocialShareButtonsProps {
  shareUrl: string;
  title?: string;
  description?: string;
  compact?: boolean;
}

export function SocialShareButtons({ 
  shareUrl, 
  title = "Join me on FamilyRoots!",
  description = "Build and explore your family tree with me on FamilyRoots - a beautiful way to preserve family history.",
  compact = false
}: SocialShareButtonsProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedTitle = encodeURIComponent(title);
  const encodedDescription = encodeURIComponent(description);
  const fullMessage = encodeURIComponent(`${title}\n\n${description}\n\n${shareUrl}`);

  const shareLinks = {
    twitter: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    whatsapp: `https://wa.me/?text=${fullMessage}`,
    email: `mailto:?subject=${encodedTitle}&body=${encodeURIComponent(`${description}\n\n${shareUrl}`)}`,
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast({
        title: "Link copied!",
        description: "Share this link with your family.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "Failed to copy",
        description: "Please copy the link manually.",
        variant: "destructive",
      });
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: description,
          url: shareUrl,
        });
      } catch {
        copyToClipboard();
      }
    } else {
      copyToClipboard();
    }
  };

  const openShareWindow = (url: string) => {
    window.open(url, "_blank", "width=600,height=400,noopener,noreferrer");
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2" data-testid="social-share-compact">
        <Button
          size="icon"
          variant="outline"
          onClick={() => openShareWindow(shareLinks.twitter)}
          title="Share on X/Twitter"
          data-testid="button-share-twitter"
        >
          <SiX className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          onClick={() => openShareWindow(shareLinks.facebook)}
          title="Share on Facebook"
          data-testid="button-share-facebook"
        >
          <Facebook className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          onClick={() => openShareWindow(shareLinks.whatsapp)}
          title="Share on WhatsApp"
          data-testid="button-share-whatsapp"
        >
          <SiWhatsapp className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          onClick={copyToClipboard}
          title="Copy link"
          data-testid="button-share-copy"
        >
          {copied ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
        </Button>
        <Button
          size="icon"
          variant="outline"
          onClick={handleNativeShare}
          title="Share"
          data-testid="button-share-native"
        >
          <Share2 className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <Card data-testid="card-social-share">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Share2 className="h-5 w-5 text-primary" />
          <CardTitle className="font-serif">Share with Family</CardTitle>
        </div>
        <CardDescription>
          Spread the word through social media or messaging
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            value={shareUrl}
            readOnly
            className="flex-1 bg-muted"
            data-testid="input-share-url"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={copyToClipboard}
            data-testid="button-copy-share-link"
          >
            {copied ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Button
            variant="outline"
            className="flex-col h-auto py-4 gap-2"
            onClick={() => openShareWindow(shareLinks.twitter)}
            data-testid="button-share-twitter-full"
          >
            <SiX className="h-5 w-5" />
            <span className="text-xs">X / Twitter</span>
          </Button>
          <Button
            variant="outline"
            className="flex-col h-auto py-4 gap-2"
            onClick={() => openShareWindow(shareLinks.facebook)}
            data-testid="button-share-facebook-full"
          >
            <Facebook className="h-5 w-5 text-blue-600" />
            <span className="text-xs">Facebook</span>
          </Button>
          <Button
            variant="outline"
            className="flex-col h-auto py-4 gap-2"
            onClick={() => openShareWindow(shareLinks.whatsapp)}
            data-testid="button-share-whatsapp-full"
          >
            <SiWhatsapp className="h-5 w-5 text-green-500" />
            <span className="text-xs">WhatsApp</span>
          </Button>
          <Button
            variant="outline"
            className="flex-col h-auto py-4 gap-2"
            onClick={() => window.location.href = shareLinks.email}
            data-testid="button-share-email-full"
          >
            <Mail className="h-5 w-5 text-muted-foreground" />
            <span className="text-xs">Email</span>
          </Button>
        </div>

        <Button
          onClick={handleNativeShare}
          className="w-full"
          data-testid="button-share-native-full"
        >
          <Share2 className="h-4 w-4 mr-2" />
          Share via Device
        </Button>
      </CardContent>
    </Card>
  );
}
