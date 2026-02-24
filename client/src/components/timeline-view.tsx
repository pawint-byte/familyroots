import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, MapPin, Cake, Heart, Star, GraduationCap, Briefcase, Church, Baby, Ribbon } from "lucide-react";
import { parseDateString } from "@/lib/utils";
import type { FamilyMember, FamilyEvent } from "@shared/schema";

interface TimelineViewProps {
  members: FamilyMember[];
  treeId: string;
}

interface TimelineEvent {
  id: string;
  date: Date;
  type: string;
  title: string;
  description?: string;
  location?: string;
  member: FamilyMember | null;
}

export default function TimelineView({ members, treeId }: TimelineViewProps) {
  const { data: lifeEvents, isLoading: eventsLoading } = useQuery<FamilyEvent[]>({
    queryKey: ['/api/trees', treeId, 'all-events'],
    queryFn: async () => {
      const res = await fetch(`/api/trees/${treeId}/all-events`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch events');
      return res.json();
    },
  });

  const memberMap = useMemo(() => {
    const map = new Map<string, FamilyMember>();
    members.forEach(m => map.set(m.id, m));
    return map;
  }, [members]);

  const events = useMemo(() => {
    const allEvents: TimelineEvent[] = [];
    const addedEventKeys = new Set<string>();

    members.forEach((member) => {
      if (member.birthDate) {
        const key = `birth-${member.id}`;
        addedEventKeys.add(key);
        allEvents.push({
          id: key,
          date: parseDateString(member.birthDate) || new Date(),
          type: "birth",
          title: `${member.firstName} ${member.lastName || ""} was born`,
          location: member.birthPlace || undefined,
          member,
        });
      }

      if (member.deathDate) {
        const key = `death-${member.id}`;
        addedEventKeys.add(key);
        allEvents.push({
          id: key,
          date: parseDateString(member.deathDate) || new Date(),
          type: "death",
          title: `${member.firstName} ${member.lastName || ""} passed away`,
          location: member.deathPlace || undefined,
          member,
        });
      }
    });

    if (lifeEvents) {
      lifeEvents.forEach((event) => {
        const eventDate = parseDateString(event.eventDate);
        if (!eventDate) return;

        const linkedMember = event.memberId ? memberMap.get(event.memberId) : null;

        if (event.eventType === "birth" && event.memberId && addedEventKeys.has(`birth-${event.memberId}`)) return;
        if (event.eventType === "death" && event.memberId && addedEventKeys.has(`death-${event.memberId}`)) return;

        allEvents.push({
          id: `event-${event.id}`,
          date: eventDate,
          type: event.eventType,
          title: event.title,
          description: event.description || undefined,
          location: event.location || undefined,
          member: linkedMember || null,
        });
      });
    }

    return allEvents.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [members, lifeEvents, memberMap]);

  const groupedEvents = useMemo(() => {
    const groups: { [year: string]: TimelineEvent[] } = {};
    events.forEach((event) => {
      const year = event.date.getFullYear().toString();
      if (!groups[year]) {
        groups[year] = [];
      }
      groups[year].push(event);
    });
    return groups;
  }, [events]);

  const years = Object.keys(groupedEvents).sort((a, b) => parseInt(b) - parseInt(a));

  if (eventsLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="space-y-4">
              <Skeleton className="h-10 w-32 rounded-full" />
              <Skeleton className="h-24 w-full rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
            <Calendar className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold mb-2" data-testid="text-no-events">No Events Yet</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            Add birth dates, death dates, and life events to your members to see them on the timeline.
          </p>
        </div>
      </div>
    );
  }

  const getEventIcon = (type: string) => {
    switch (type) {
      case "birth":
        return <Cake className="h-4 w-4" />;
      case "death":
        return <Star className="h-4 w-4" />;
      case "marriage":
        return <Heart className="h-4 w-4" />;
      case "graduation":
        return <GraduationCap className="h-4 w-4" />;
      case "career":
      case "retirement":
        return <Briefcase className="h-4 w-4" />;
      case "baptism":
      case "religious":
        return <Church className="h-4 w-4" />;
      case "adoption":
        return <Baby className="h-4 w-4" />;
      case "milestone":
        return <Ribbon className="h-4 w-4" />;
      default:
        return <Calendar className="h-4 w-4" />;
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case "birth":
        return "bg-primary/10 text-primary border-primary/20";
      case "death":
        return "bg-muted text-muted-foreground border-muted-foreground/20";
      case "marriage":
        return "bg-pink-500/10 text-pink-600 border-pink-500/20";
      case "graduation":
        return "bg-blue-500/10 text-blue-600 border-blue-500/20";
      case "milestone":
        return "bg-amber-500/10 text-amber-600 border-amber-500/20";
      default:
        return "bg-accent/10 text-accent-foreground border-accent/20";
    }
  };

  const getEventLabel = (type: string) => {
    switch (type) {
      case "birth": return "Birth";
      case "death": return "Death";
      case "marriage": return "Marriage";
      case "divorce": return "Divorce";
      case "graduation": return "Graduation";
      case "career": return "Career";
      case "retirement": return "Retirement";
      case "baptism": return "Baptism";
      case "religious": return "Religious";
      case "adoption": return "Adoption";
      case "milestone": return "Milestone";
      default: return type.charAt(0).toUpperCase() + type.slice(1);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-muted-foreground" data-testid="text-event-count">
            {events.length} event{events.length !== 1 ? 's' : ''} across {years.length} year{years.length !== 1 ? 's' : ''}
          </p>
        </div>

        {years.map((year) => (
          <div key={year} className="relative">
            <div className="sticky top-20 z-10 mb-6">
              <div className="inline-flex items-center px-4 py-2 bg-background border border-border rounded-full shadow-sm">
                <span className="font-serif text-lg font-semibold">{year}</span>
                <Badge variant="secondary" className="ml-2">
                  {groupedEvents[year].length} event{groupedEvents[year].length !== 1 ? 's' : ''}
                </Badge>
              </div>
            </div>

            <div className="relative pl-8 border-l-2 border-border mb-12">
              {groupedEvents[year].map((event) => (
                <div key={event.id} className="relative mb-8 last:mb-0" data-testid={`timeline-event-${event.id}`}>
                  <div 
                    className={`absolute -left-[25px] w-4 h-4 rounded-full border-2 ${getEventColor(event.type)}`}
                  />
                  
                  <Card className="hover-elevate">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        {event.member ? (
                          <Avatar className="h-12 w-12 flex-shrink-0">
                            <AvatarImage src={event.member.photoUrl || undefined} />
                            <AvatarFallback className="bg-primary/10 text-primary font-serif">
                              {event.member.firstName[0]}
                              {event.member.lastName?.[0] || ""}
                            </AvatarFallback>
                          </Avatar>
                        ) : (
                          <div className="h-12 w-12 flex-shrink-0 rounded-full bg-muted flex items-center justify-center">
                            {getEventIcon(event.type)}
                          </div>
                        )}
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge 
                              variant="outline" 
                              className={`${getEventColor(event.type)} gap-1`}
                            >
                              {getEventIcon(event.type)}
                              <span>{getEventLabel(event.type)}</span>
                            </Badge>
                          </div>
                          
                          <h4 className="font-medium text-base mb-1">
                            {event.title}
                          </h4>
                          
                          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              <span>
                                {event.date.toLocaleDateString("en-US", {
                                  month: "long",
                                  day: "numeric",
                                  year: "numeric",
                                })}
                              </span>
                            </div>
                            
                            {event.location && (
                              <div className="flex items-center gap-1">
                                <MapPin className="h-3.5 w-3.5" />
                                <span>{event.location}</span>
                              </div>
                            )}
                          </div>
                          
                          {event.description && (
                            <p className="text-sm text-muted-foreground mt-2">
                              {event.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
