import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Cake, Heart, Star } from "lucide-react";
import { parseDateString } from "@/lib/utils";
import type { FamilyMember } from "@shared/schema";

interface TimelineViewProps {
  members: FamilyMember[];
  treeId: string;
}

interface TimelineEvent {
  id: string;
  date: Date;
  type: "birth" | "death" | "other";
  title: string;
  description?: string;
  location?: string;
  member: FamilyMember;
}

export default function TimelineView({ members, treeId }: TimelineViewProps) {
  const events = useMemo(() => {
    const allEvents: TimelineEvent[] = [];

    members.forEach((member) => {
      if (member.birthDate) {
        allEvents.push({
          id: `birth-${member.id}`,
          date: parseDateString(member.birthDate) || new Date(),
          type: "birth",
          title: `${member.firstName} ${member.lastName || ""} was born`,
          location: member.birthPlace || undefined,
          member,
        });
      }

      if (member.deathDate) {
        allEvents.push({
          id: `death-${member.id}`,
          date: parseDateString(member.deathDate) || new Date(),
          type: "death",
          title: `${member.firstName} ${member.lastName || ""} passed away`,
          member,
        });
      }
    });

    return allEvents.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [members]);

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

  if (events.length === 0) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
            <Calendar className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No Events Yet</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            Add birth dates and other important dates to your family members to see them on the timeline.
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
      default:
        return "bg-accent/10 text-accent-foreground border-accent/20";
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        {years.map((year) => (
          <div key={year} className="relative">
            <div className="sticky top-20 z-10 mb-6">
              <div className="inline-flex items-center px-4 py-2 bg-background border border-border rounded-full shadow-sm">
                <span className="font-serif text-lg font-semibold">{year}</span>
                <Badge variant="secondary" className="ml-2">
                  {groupedEvents[year].length} events
                </Badge>
              </div>
            </div>

            <div className="relative pl-8 border-l-2 border-border mb-12">
              {groupedEvents[year].map((event, index) => (
                <div key={event.id} className="relative mb-8 last:mb-0">
                  <div 
                    className={`absolute -left-[25px] w-4 h-4 rounded-full border-2 ${getEventColor(event.type)}`}
                  />
                  
                  <Card className="hover-elevate">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <Avatar className="h-12 w-12 flex-shrink-0">
                          <AvatarImage src={event.member.photoUrl || undefined} />
                          <AvatarFallback className="bg-primary/10 text-primary font-serif">
                            {event.member.firstName[0]}
                            {event.member.lastName?.[0] || ""}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge 
                              variant="outline" 
                              className={`${getEventColor(event.type)} gap-1`}
                            >
                              {getEventIcon(event.type)}
                              <span className="capitalize">{event.type}</span>
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
