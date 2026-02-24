import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Gift, Calendar, ExternalLink, ShoppingBag, PartyPopper, Baby, Heart, GraduationCap, Home, Sparkles } from "lucide-react";
import { parseDateString } from "@/lib/utils";
import type { GiftRegistry } from "@shared/schema";

interface EnrichedRegistry extends GiftRegistry {
  memberName: string;
  memberPhoto: string | null;
  itemCount: number;
  purchasedCount: number;
  progress: number;
}

interface TreeRegistriesTabProps {
  treeId: string;
  canEdit: boolean;
}

const getEventTypeIcon = (eventType: string) => {
  switch (eventType) {
    case "birthday": return <PartyPopper className="h-4 w-4" />;
    case "baby_shower": return <Baby className="h-4 w-4" />;
    case "wedding": return <Heart className="h-4 w-4" />;
    case "anniversary": return <Heart className="h-4 w-4" />;
    case "graduation": return <GraduationCap className="h-4 w-4" />;
    case "housewarming": return <Home className="h-4 w-4" />;
    case "holiday": return <Sparkles className="h-4 w-4" />;
    default: return <Gift className="h-4 w-4" />;
  }
};

const getEventTypeLabel = (eventType: string) => {
  switch (eventType) {
    case "birthday": return "Birthday";
    case "baby_shower": return "Baby Shower";
    case "wedding": return "Wedding";
    case "anniversary": return "Anniversary";
    case "graduation": return "Graduation";
    case "housewarming": return "Housewarming";
    case "holiday": return "Holiday";
    default: return eventType.charAt(0).toUpperCase() + eventType.slice(1).replace(/_/g, ' ');
  }
};

export function TreeRegistriesTab({ treeId, canEdit }: TreeRegistriesTabProps) {
  const [, navigate] = useLocation();

  const { data: registries, isLoading } = useQuery<EnrichedRegistry[]>({
    queryKey: ['/api/trees', treeId, 'registries'],
    queryFn: async () => {
      const res = await fetch(`/api/trees/${treeId}/registries`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch registries');
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-32 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const activeRegistries = registries?.filter(r => r.isActive) || [];
  const pastRegistries = registries?.filter(r => !r.isActive) || [];

  if (!registries || registries.length === 0) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
            <Gift className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold mb-2" data-testid="text-no-registries">No Gift Registries Yet</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            Gift registries let members share wishlists for birthdays, weddings, baby showers, and more. 
            Create one from any member's profile panel.
          </p>
        </div>
      </div>
    );
  }

  const renderRegistry = (registry: EnrichedRegistry) => {
    const eventDate = registry.eventDate ? parseDateString(registry.eventDate) : null;
    const daysUntil = eventDate ? Math.ceil((eventDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;

    return (
      <Card key={registry.id} className="hover-elevate" data-testid={`registry-card-${registry.id}`}>
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <Avatar className="h-14 w-14 flex-shrink-0">
              <AvatarImage src={registry.memberPhoto || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary font-serif text-lg">
                {registry.memberName.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-1">
                <div>
                  <h4 className="font-semibold text-base" data-testid={`text-registry-title-${registry.id}`}>
                    {registry.title}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    for {registry.memberName}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className="gap-1">
                    {getEventTypeIcon(registry.eventType)}
                    {getEventTypeLabel(registry.eventType)}
                  </Badge>
                  {registry.isActive ? (
                    <Badge className="bg-green-500/10 text-green-600 border-green-500/20" variant="outline">Active</Badge>
                  ) : (
                    <Badge variant="secondary">Closed</Badge>
                  )}
                </div>
              </div>

              {registry.description && (
                <p className="text-sm text-muted-foreground mt-1 mb-2">{registry.description}</p>
              )}

              <div className="flex flex-wrap items-center gap-4 mt-3">
                {eventDate && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>
                      {eventDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                    </span>
                    {daysUntil !== null && daysUntil >= 0 && daysUntil <= 60 && (
                      <Badge variant="secondary" className="ml-1 text-xs">
                        {daysUntil === 0 ? "Today!" : daysUntil === 1 ? "Tomorrow" : `${daysUntil} days away`}
                      </Badge>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <ShoppingBag className="h-3.5 w-3.5" />
                  <span>{registry.purchasedCount} of {registry.itemCount} item{registry.itemCount !== 1 ? 's' : ''} fulfilled</span>
                </div>
              </div>

              {registry.itemCount > 0 && (
                <div className="mt-3">
                  <Progress value={registry.progress} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-1">{registry.progress}% complete</p>
                </div>
              )}

              <div className="mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => navigate(`/registry/${registry.id}`)}
                  data-testid={`button-view-registry-${registry.id}`}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  View Registry
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="max-w-3xl mx-auto">
        {activeRegistries.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Gift className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-lg" data-testid="text-active-registries-heading">
                Active Registries
              </h3>
              <Badge variant="secondary">{activeRegistries.length}</Badge>
            </div>
            <div className="space-y-4">
              {activeRegistries.map(renderRegistry)}
            </div>
          </div>
        )}

        {pastRegistries.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <h3 className="font-semibold text-lg text-muted-foreground" data-testid="text-past-registries-heading">
                Past Registries
              </h3>
              <Badge variant="secondary">{pastRegistries.length}</Badge>
            </div>
            <div className="space-y-4 opacity-75">
              {pastRegistries.map(renderRegistry)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
