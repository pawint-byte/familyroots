import { useState, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { SEO } from "@/components/seo";
import { QRCodeSVG } from "qrcode.react";
import {
  ArrowLeft, Download, Share2, Copy, Check, TreeDeciduous,
  Users, Award, Calendar, Sparkles, Shield, Star, Loader2
} from "lucide-react";

interface BadgeStats {
  treeCount: number;
  totalMembers: number;
  treeNames: string[];
  completedReferrals: number;
  memberSince: string;
  referralCode: string | null;
}

function getMemberTier(totalMembers: number): { label: string; color: string; bgClass: string; borderClass: string } {
  if (totalMembers >= 100) return { label: "Legacy Builder", color: "#f59e0b", bgClass: "from-amber-500 to-yellow-600", borderClass: "border-amber-400" };
  if (totalMembers >= 50) return { label: "Heritage Keeper", color: "#8b5cf6", bgClass: "from-violet-500 to-purple-600", borderClass: "border-violet-400" };
  if (totalMembers >= 25) return { label: "Family Historian", color: "#3b82f6", bgClass: "from-blue-500 to-indigo-600", borderClass: "border-blue-400" };
  if (totalMembers >= 10) return { label: "Tree Grower", color: "#10b981", bgClass: "from-emerald-500 to-green-600", borderClass: "border-emerald-400" };
  return { label: "Root Starter", color: "#6b7280", bgClass: "from-gray-500 to-slate-600", borderClass: "border-gray-400" };
}

function MembershipCard({
  user,
  stats,
  referralUrl,
  cardRef,
}: {
  user: any;
  stats: BadgeStats;
  referralUrl: string;
  cardRef: React.RefObject<HTMLDivElement | null>;
}) {
  const tier = getMemberTier(stats.totalMembers);
  const memberSinceDate = stats.memberSince
    ? new Date(stats.memberSince).toLocaleDateString("en-US", { month: "short", year: "numeric" })
    : "Recently";

  const initials = `${user.firstName?.[0] || user.email?.[0]?.toUpperCase() || ""}${user.lastName?.[0] || ""}`.toUpperCase() || "?";
  const displayName = user.firstName
    ? `${user.firstName}${user.lastName ? " " + user.lastName : ""}`
    : user.email?.split("@")[0] || "Member";

  return (
    <div
      ref={cardRef}
      className="relative w-full max-w-md mx-auto overflow-hidden rounded-md shadow-sm border"
      data-testid="membership-card"
    >
      <div className={`bg-gradient-to-br ${tier.bgClass} p-6 pb-4 text-white relative`}>
        <div className="absolute top-0 left-0 right-0 bottom-0 opacity-10">
          <svg viewBox="0 0 400 200" className="w-full h-full">
            <path d="M0,100 Q100,20 200,100 T400,100" fill="none" stroke="white" strokeWidth="2" opacity="0.3" />
            <path d="M0,120 Q100,40 200,120 T400,120" fill="none" stroke="white" strokeWidth="1.5" opacity="0.2" />
            <path d="M0,140 Q100,60 200,140 T400,140" fill="none" stroke="white" strokeWidth="1" opacity="0.1" />
            <circle cx="50" cy="30" r="30" fill="white" opacity="0.05" />
            <circle cx="350" cy="50" r="45" fill="white" opacity="0.04" />
          </svg>
        </div>

        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TreeDeciduous className="h-5 w-5" />
              <span className="text-sm font-semibold tracking-wider uppercase opacity-90">FamilyRoots</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1">
              <Award className="h-3.5 w-3.5" />
              <span className="text-xs font-bold">{tier.label}</span>
            </div>
          </div>

          <div className="flex items-center gap-4 mb-4">
            <div className={`rounded-full border-2 ${tier.borderClass} p-0.5`}>
              <Avatar className="h-16 w-16">
                <AvatarImage src={user.profileImageUrl || undefined} />
                <AvatarFallback className="text-xl bg-white/20 text-white">{initials}</AvatarFallback>
              </Avatar>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold truncate">{displayName}</h2>
              <div className="flex items-center gap-1.5 text-white/80 text-sm mt-0.5">
                <Calendar className="h-3.5 w-3.5" />
                <span>Member since {memberSinceDate}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 px-6 py-4">
        <div className="grid grid-cols-3 gap-3 text-center mb-4">
          <div>
            <div className="text-2xl font-bold text-foreground">{stats.treeCount}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Trees</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-foreground">{stats.totalMembers}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Members</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-foreground">{stats.completedReferrals}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Invited</div>
          </div>
        </div>

        {stats.treeNames.length > 0 && (
          <div className="mb-4">
            <div className="flex flex-wrap gap-1.5 justify-center">
              {stats.treeNames.map((name, i) => (
                <Badge key={i} variant="secondary" className="text-[10px] px-2 py-0.5">
                  {name}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 border-t pt-4">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground mb-0.5">Join my network</p>
            <p className="text-[10px] text-muted-foreground">Scan to sign up and connect with me on FamilyRoots</p>
          </div>
          <div className="bg-white p-1.5 rounded-md border flex-shrink-0">
            <QRCodeSVG
              value={referralUrl}
              size={72}
              level="M"
              data-testid="badge-qr-code"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MembershipBadgePage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const [copied, setCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const { data: stats, isLoading: statsLoading } = useQuery<BadgeStats>({
    queryKey: ["/api/user/badge-stats"],
    enabled: !!user,
  });

  const baseUrl = typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.host}`
    : "";

  const referralUrl = stats?.referralCode
    ? `${baseUrl}/?ref=${stats.referralCode}`
    : baseUrl;

  const handleDownload = useCallback(async () => {
    if (!cardRef.current) return;
    setIsDownloading(true);

    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(cardRef.current, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
      });

      const link = document.createElement("a");
      link.download = `familyroots-membership-${user?.firstName || "badge"}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({ title: "Badge Downloaded", description: "Your membership badge has been saved as an image." });
    } catch (error) {
      console.error("Failed to download badge:", error);
      toast({ title: "Download Failed", description: "Could not generate badge image. Please try again.", variant: "destructive" });
    } finally {
      setIsDownloading(false);
    }
  }, [user, toast]);

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      toast({ title: "Link Copied", description: "Your referral link has been copied to clipboard." });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Copy Failed", description: "Could not copy link to clipboard.", variant: "destructive" });
    }
  }, [referralUrl, toast]);

  const handleShare = useCallback(async () => {
    const shareData: ShareData = {
      title: `${user?.firstName || "I"}'m a FamilyRoots member!`,
      text: `I'm building my family tree on FamilyRoots — join me and connect with your roots!`,
      url: referralUrl,
    };

    if (navigator.share) {
      try {
        if (cardRef.current) {
          const { toPng } = await import("html-to-image");
          const dataUrl = await toPng(cardRef.current, { quality: 0.9, pixelRatio: 2, backgroundColor: "#ffffff" });
          const response = await fetch(dataUrl);
          const blob = await response.blob();
          const file = new File([blob], "familyroots-badge.png", { type: "image/png" });

          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({ ...shareData, files: [file] });
            return;
          }
        }
        await navigator.share(shareData);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          handleCopyLink();
        }
      }
    } else {
      handleCopyLink();
    }
  }, [user, referralUrl, handleCopyLink]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-center">
          <Award className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    navigate("/");
    return null;
  }

  const tier = stats ? getMemberTier(stats.totalMembers) : null;

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="My Membership Badge | FamilyRoots"
        description="Download and share your FamilyRoots membership badge. Show off your family tree accomplishments and invite others to join."
      />
      <header className="border-b sticky top-0 bg-background z-10">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/dashboard")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Award className="h-6 w-6 text-foreground" />
            <h1 className="text-xl font-semibold">Membership Badge</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-lg">
        <Card className="mb-6 bg-muted/50 border-border">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-sm">Show off your membership!</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Download your personalized badge and share it on social media, in group chats,
                  or at family gatherings. The QR code on your badge links directly to FamilyRoots
                  with your referral — making it easy for others to sign up and connect with you.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {statsLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-64 w-full rounded-md" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : stats ? (
          <>
            <MembershipCard
              user={user}
              stats={stats}
              referralUrl={referralUrl}
              cardRef={cardRef}
            />

            <div className="mt-6 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  onClick={handleDownload}
                  disabled={isDownloading}
                  className="w-full"
                  data-testid="button-download-badge"
                >
                  {isDownloading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Download
                </Button>
                <Button
                  onClick={handleShare}
                  className="w-full"
                  data-testid="button-share-badge"
                >
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </Button>
              </div>

              <div className="flex gap-2">
                <Input
                  readOnly
                  value={referralUrl}
                  className="flex-1 font-mono text-xs bg-muted truncate"
                  data-testid="input-referral-url"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopyLink}
                  data-testid="button-copy-referral"
                >
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {tier && (
              <Card className="mt-6">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Star className="h-4 w-4" />
                    Membership Tiers
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Grow your trees to unlock higher tiers
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { label: "Root Starter", members: "0-9", color: "bg-gray-400" },
                      { label: "Tree Grower", members: "10-24", color: "bg-emerald-500" },
                      { label: "Family Historian", members: "25-49", color: "bg-blue-500" },
                      { label: "Heritage Keeper", members: "50-99", color: "bg-violet-500" },
                      { label: "Legacy Builder", members: "100+", color: "bg-amber-500" },
                    ].map((t) => {
                      const isActive = t.label === tier.label;
                      return (
                        <div
                          key={t.label}
                          className={`flex items-center justify-between p-2 rounded-md text-sm ${
                            isActive ? "bg-muted border border-border" : "opacity-60"
                          }`}
                          data-testid={`tier-${t.label.toLowerCase().replace(/\s/g, "-")}`}
                        >
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${t.color}`} />
                            <span className={isActive ? "font-semibold" : ""}>{t.label}</span>
                            {isActive && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                You
                              </Badge>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">{t.members} members</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="mt-6 border-t pt-4">
              <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                <Shield className="h-4 w-4" />
                How sharing works
              </h4>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li className="flex items-start gap-2">
                  <span className="font-bold">1.</span>
                  <span>Download or share your badge image</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold">2.</span>
                  <span>Post it on social media or send it in group chats</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold">3.</span>
                  <span>Anyone who scans the QR code or uses your link signs up with your referral</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold">4.</span>
                  <span>They can then connect with you and join your trees</span>
                </li>
              </ul>
            </div>
          </>
        ) : (
          <Card>
            <CardContent className="py-8 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Could not load your membership data. Please try again.</p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
