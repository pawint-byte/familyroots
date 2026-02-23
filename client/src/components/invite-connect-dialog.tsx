import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Copy, Share2, Mail, MessageSquare, Check, UserPlus, Link2, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { getTreeTypeConfig, type TreeType } from "@shared/treeTypes";

interface InviteConnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  treeId: string;
  treeName: string;
  treeType: string;
}

export function InviteConnectDialog({ open, onOpenChange, treeId, treeName, treeType }: InviteConnectDialogProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const connectUrl = `${window.location.origin}/connect/${treeId}`;
  const treeTypeConfig = getTreeTypeConfig((treeType || "family") as TreeType);

  const roleExamples = treeTypeConfig.defaultRelationshipTypes
    .slice(0, 4)
    .map(r => r.label)
    .join(", ");

  const handleCopy = () => {
    navigator.clipboard.writeText(connectUrl);
    setCopied(true);
    toast({ title: "Link Copied!", description: "Paste it anywhere to share." });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Connect to ${treeName} on FamilyRoots`,
          text: `You've been invited to connect to "${treeName}". Open the link to pick your role and send a request.`,
          url: connectUrl,
        });
      } catch (err: any) {
        if (err?.name !== "AbortError") {
          handleCopy();
        }
      }
    } else {
      handleCopy();
    }
  };

  const handleEmail = () => {
    const subject = encodeURIComponent(`Connect to ${treeName} on FamilyRoots`);
    const body = encodeURIComponent(
      `You've been invited to connect to "${treeName}" on FamilyRoots!\n\nOpen this link to pick your role and send a connection request:\n${connectUrl}`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`, "_blank");
  };

  const handleSMS = () => {
    const body = encodeURIComponent(
      `You've been invited to connect to "${treeName}" on FamilyRoots! Open this link to join: ${connectUrl}`
    );
    window.open(`sms:?body=${body}`, "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={true}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Invite to Connect
          </DialogTitle>
          <DialogDescription>
            Invite someone to join <strong>{treeName}</strong>. They'll pick their role and send you a request to approve.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="p-3 bg-muted rounded-lg space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline">{treeTypeConfig.label}</Badge>
              <span className="text-sm font-medium truncate">{treeName}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              The recipient will choose from roles like: {roleExamples}
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Connection invite link</Label>
            <div className="flex gap-2">
              <Input
                value={connectUrl}
                readOnly
                className="text-xs font-mono"
                data-testid="input-connect-url"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopy}
                data-testid="button-copy-connect-link"
                className="shrink-0"
              >
                {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Send via</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="gap-2 justify-start"
                onClick={handleNativeShare}
                data-testid="button-share-native"
              >
                <Share2 className="h-4 w-4" />
                Share
              </Button>
              <Button
                variant="outline"
                className="gap-2 justify-start"
                onClick={handleEmail}
                data-testid="button-share-email"
              >
                <Mail className="h-4 w-4" />
                Email
              </Button>
              <Button
                variant="outline"
                className="gap-2 justify-start"
                onClick={handleSMS}
                data-testid="button-share-sms"
              >
                <MessageSquare className="h-4 w-4" />
                Text Message
              </Button>
              <Button
                variant="outline"
                className="gap-2 justify-start"
                onClick={() => setShowQR(!showQR)}
                data-testid="button-share-qr"
              >
                <QrCode className="h-4 w-4" />
                QR Code
              </Button>
            </div>
          </div>

          {showQR && (
            <div className="flex flex-col items-center gap-3 p-4 bg-white rounded-lg">
              <QRCodeSVG value={connectUrl} size={180} level="H" includeMargin={false} />
              <p className="text-xs text-muted-foreground text-center">
                Scan to connect to <strong>{treeName}</strong>
              </p>
            </div>
          )}

          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground">
              When someone opens this link, they'll see your tree name and can choose their role or relationship. You'll get a notification to approve their request before they're added.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}