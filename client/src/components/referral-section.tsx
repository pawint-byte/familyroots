import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Share2, Copy, Users, MousePointerClick, CheckCircle2, Gift } from "lucide-react";

interface ReferralData {
  referralCode: string;
  referralLink: string;
  totalReferrals: number;
  completedReferrals: number;
  pendingReferrals: number;
  referrals: Array<{
    id: string;
    status: string;
    clickCount: number;
    completedAt: string | null;
    createdAt: string;
  }>;
}

export function ReferralSection() {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const { data: referralData, isLoading } = useQuery<ReferralData>({
    queryKey: ["/api/referrals/my"],
  });

  const copyToClipboard = async () => {
    if (referralData?.referralLink) {
      try {
        await navigator.clipboard.writeText(referralData.referralLink);
        setCopied(true);
        toast({
          title: "Link copied!",
          description: "Share this link with friends and family to invite them.",
        });
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        toast({
          title: "Failed to copy",
          description: "Please copy the link manually.",
          variant: "destructive",
        });
      }
    }
  };

  const shareLink = async () => {
    if (referralData?.referralLink && navigator.share) {
      try {
        await navigator.share({
          title: "Join FamilyRoots",
          text: "Build your family tree and connect with relatives on FamilyRoots!",
          url: referralData.referralLink,
        });
      } catch (err) {
        copyToClipboard();
      }
    } else {
      copyToClipboard();
    }
  };

  if (isLoading) {
    return (
      <Card data-testid="card-referral-loading">
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-60" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <div className="flex gap-4">
            <Skeleton className="h-20 w-24" />
            <Skeleton className="h-20 w-24" />
            <Skeleton className="h-20 w-24" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-referral-section">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Gift className="h-5 w-5 text-primary" />
          <CardTitle className="font-serif">Invite Friends & Family</CardTitle>
        </div>
        <CardDescription>
          Share FamilyRoots with others and help them build their family trees
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium">Your Referral Link</label>
          <div className="flex gap-2">
            <Input
              value={referralData?.referralLink || ""}
              readOnly
              className="flex-1 bg-muted"
              data-testid="input-referral-link"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={copyToClipboard}
              data-testid="button-copy-link"
            >
              {copied ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
            <Button onClick={shareLink} data-testid="button-share-link">
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 rounded-lg bg-muted/50">
            <MousePointerClick className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
            <div className="text-2xl font-bold" data-testid="text-click-count">
              {referralData?.referrals[0]?.clickCount || 0}
            </div>
            <div className="text-xs text-muted-foreground">Link Clicks</div>
          </div>
          <div className="text-center p-4 rounded-lg bg-muted/50">
            <Users className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
            <div className="text-2xl font-bold" data-testid="text-pending-count">
              {referralData?.pendingReferrals || 0}
            </div>
            <div className="text-xs text-muted-foreground">Pending</div>
          </div>
          <div className="text-center p-4 rounded-lg bg-green-500/10">
            <CheckCircle2 className="h-6 w-6 mx-auto mb-2 text-green-500" />
            <div className="text-2xl font-bold text-green-600" data-testid="text-completed-count">
              {referralData?.completedReferrals || 0}
            </div>
            <div className="text-xs text-muted-foreground">Signed Up</div>
          </div>
        </div>

        {referralData && referralData.completedReferrals > 0 && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
            <Gift className="h-5 w-5 text-green-500" />
            <span className="text-sm text-green-700 dark:text-green-400">
              Thank you for spreading the word! You've helped {referralData.completedReferrals} people discover FamilyRoots.
            </span>
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          <Badge variant="secondary" className="mr-2">Code: {referralData?.referralCode}</Badge>
          Share your unique link to invite others to join FamilyRoots
        </div>
      </CardContent>
    </Card>
  );
}
