import { useState } from "react";
import { useLocation } from "wouter";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Copy, Check, Download, Share2, QrCode, UserCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

export default function SharePage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user, isLoading } = useAuth();
  const [copied, setCopied] = useState(false);

  const baseUrl = typeof window !== "undefined" 
    ? `${window.location.protocol}//${window.location.host}` 
    : "";

  // If logged in, share personal profile URL; otherwise share app URL
  const isPersonalShare = !!user;
  const shareUrl = isPersonalShare 
    ? `${baseUrl}/profile/${user.id}` 
    : baseUrl;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast({
        title: "Link Copied",
        description: isPersonalShare ? "Your profile link copied to clipboard" : "App link copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Could not copy link to clipboard",
        variant: "destructive",
      });
    }
  };

  const handleDownloadQR = () => {
    const svg = document.getElementById("qr-code-svg");
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    
    img.onload = () => {
      canvas.width = 400;
      canvas.height = 400;
      if (ctx) {
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, 400, 400);
        
        const pngUrl = canvas.toDataURL("image/png");
        const downloadLink = document.createElement("a");
        downloadLink.href = pngUrl;
        downloadLink.download = isPersonalShare 
          ? `${user?.firstName || "my"}-profile-qr.png`
          : "familyroots-qr-code.png";
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
      }
    };
    
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: isPersonalShare ? `Connect with ${user?.firstName} on FamilyRoots` : "FamilyRoots",
          text: isPersonalShare 
            ? `Scan to connect with ${user?.firstName} ${user?.lastName || ""} on FamilyRoots`
            : "Create and manage your family tree with FamilyRoots",
          url: shareUrl,
        });
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          toast({
            title: "Share Failed",
            description: "Could not share",
            variant: "destructive",
          });
        }
      }
    } else {
      handleCopyLink();
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-center">
          <QrCode className="h-12 w-12 mx-auto mb-4 text-primary/50" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 bg-background z-10">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(user ? "/dashboard" : "/")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            {isPersonalShare ? (
              <UserCircle className="h-6 w-6 text-primary" />
            ) : (
              <QrCode className="h-6 w-6 text-primary" />
            )}
            <h1 className="text-xl font-semibold">
              {isPersonalShare ? "Share Your Profile" : "Share FamilyRoots"}
            </h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-lg">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              {isPersonalShare ? (
                <>
                  <UserCircle className="h-5 w-5" />
                  Your Personal QR Code
                </>
              ) : (
                <>
                  <Share2 className="h-5 w-5" />
                  Share This App
                </>
              )}
            </CardTitle>
            <CardDescription>
              {isPersonalShare ? (
                <>
                  Family members can scan this to connect with you on FamilyRoots.
                  <span className="block mt-1 font-medium text-foreground">
                    Perfect for family reunions!
                  </span>
                </>
              ) : (
                "Scan this QR code or share the link to invite others to FamilyRoots"
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {isPersonalShare && (
              <div className="text-center pb-2">
                <p className="text-lg font-medium">{user?.firstName} {user?.lastName}</p>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
            )}

            <div className="flex justify-center p-4 bg-white rounded-lg">
              <QRCodeSVG
                id="qr-code-svg"
                value={shareUrl}
                size={256}
                level="H"
                includeMargin
                data-testid="qr-code"
              />
            </div>

            <div className="space-y-3">
              <div className="flex gap-2">
                <Input 
                  value={shareUrl} 
                  readOnly 
                  className="font-mono text-sm"
                  data-testid="input-share-url"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopyLink}
                  data-testid="button-copy-link"
                >
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  onClick={handleDownloadQR}
                  className="w-full"
                  data-testid="button-download-qr"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download QR
                </Button>
                <Button
                  onClick={handleShare}
                  className="w-full"
                  data-testid="button-share"
                >
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </Button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              {isPersonalShare 
                ? "When scanned, they'll be prompted to connect with you"
                : "Point your phone camera at the QR code to open the app"
              }
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
