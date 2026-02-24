import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart3, Users, Link2, Calendar, BookHeart, Mic, Cake,
  Star, ChevronLeft, ChevronRight, TrendingUp, Award, Heart, TreeDeciduous
} from "lucide-react";

interface AnnualReportProps {
  treeId: string;
  treeName: string;
}

interface ReportData {
  year: number;
  treeName: string;
  treeType: string;
  totalMembers: number;
  totalRelationships: number;
  membersAdded: number;
  newMemberNames: string[];
  eventsRecorded: number;
  eventTypes: Record<string, number>;
  memoriesShared: number;
  voiceNotesRecorded: number;
  milestoneBirthdays: { member: any; date: string }[];
  milestoneEvents: { member: any; event: any }[];
  relationshipBreakdown: Record<string, number>;
  oldestMember: { name: string; date: string } | null;
  youngestMember: { name: string; date: string } | null;
}

export function AnnualTreeReport({ treeId, treeName }: AnnualReportProps) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);

  const { data: report, isLoading } = useQuery<ReportData>({
    queryKey: ['/api/trees', treeId, 'annual-report', year],
    queryFn: async () => {
      const res = await fetch(`/api/trees/${treeId}/annual-report?year=${year}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch report');
      return res.json();
    },
  });

  const years = Array.from({ length: 10 }, (_, i) => currentYear - i);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-3xl space-y-4">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!report) return null;

  const statCards = [
    { label: "Total Members", value: report.totalMembers, icon: Users, color: "text-blue-600" },
    { label: "Relationships", value: report.totalRelationships, icon: Link2, color: "text-purple-600" },
    { label: "Members Added", value: report.membersAdded, icon: TrendingUp, color: "text-green-600" },
    { label: "Events Recorded", value: report.eventsRecorded, icon: Calendar, color: "text-amber-600" },
    { label: "Memories Shared", value: report.memoriesShared, icon: BookHeart, color: "text-rose-600" },
    { label: "Voice Notes", value: report.voiceNotesRecorded, icon: Mic, color: "text-cyan-600" },
  ];

  const maxRelCount = Math.max(...Object.values(report.relationshipBreakdown), 1);

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
            <BarChart3 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-serif font-bold" data-testid="text-annual-report-title">
              {year} Annual Report
            </h2>
            <p className="text-sm text-muted-foreground">{treeName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setYear(y => y - 1)}
            disabled={year <= currentYear - 9}
            data-testid="button-prev-year"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Select value={year.toString()} onValueChange={v => setYear(parseInt(v))}>
            <SelectTrigger className="w-24" data-testid="select-report-year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map(y => (
                <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setYear(y => y + 1)}
            disabled={year >= currentYear}
            data-testid="button-next-year"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        {statCards.map((stat, i) => (
          <Card key={i} className="bg-card" data-testid={`stat-card-${i}`}>
            <CardContent className="p-4 flex flex-col items-center text-center">
              <stat.icon className={`h-6 w-6 ${stat.color} mb-2`} />
              <div className="text-2xl font-bold">{stat.value}</div>
              <div className="text-xs text-muted-foreground">{stat.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {report.membersAdded > 0 && report.newMemberNames.length > 0 && (
        <Card className="mb-4" data-testid="card-new-members">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-green-600" />
              New Members in {year}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {report.newMemberNames.map((name, i) => (
                <Badge key={i} variant="secondary" className="text-xs">{name.trim()}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {Object.keys(report.relationshipBreakdown).length > 0 && (
        <Card className="mb-4" data-testid="card-relationship-breakdown">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Link2 className="h-4 w-4 text-purple-600" />
              Relationship Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(report.relationshipBreakdown)
                .sort(([, a], [, b]) => b - a)
                .map(([type, count]) => (
                  <div key={type} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-24 truncate capitalize">{type}</span>
                    <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary/60 rounded-full transition-all"
                        style={{ width: `${(count / maxRelCount) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium w-8 text-right">{count}</span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {Object.keys(report.eventTypes).length > 0 && (
        <Card className="mb-4" data-testid="card-event-types">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4 text-amber-600" />
              Events by Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(report.eventTypes).map(([type, count]) => (
                <Badge key={type} variant="outline" className="gap-1 capitalize">
                  {type}: {count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {report.milestoneBirthdays.length > 0 && (
        <Card className="mb-4" data-testid="card-milestone-birthdays">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Cake className="h-4 w-4 text-rose-500" />
              Milestone Birthdays
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {report.milestoneBirthdays.map((b, i) => {
                const bd = b.date ? new Date(b.date) : null;
                const age = bd ? year - bd.getFullYear() : null;
                return (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <Cake className="h-3.5 w-3.5 text-rose-400" />
                    <span>{b.member?.firstName} {b.member?.lastName || ""}</span>
                    {age && <Badge variant="secondary" className="text-xs">Turns {age}</Badge>}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {(report.oldestMember || report.youngestMember) && (
        <Card className="mb-4" data-testid="card-age-highlights">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Award className="h-4 w-4 text-yellow-600" />
              Tree Highlights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {report.oldestMember && (
              <div className="flex items-center gap-2 text-sm">
                <TreeDeciduous className="h-4 w-4 text-amber-600" />
                <span className="text-muted-foreground">Oldest member:</span>
                <span className="font-medium">{report.oldestMember.name}</span>
                {report.oldestMember.date && (
                  <Badge variant="outline" className="text-xs">
                    b. {new Date(report.oldestMember.date).getFullYear()}
                  </Badge>
                )}
              </div>
            )}
            {report.youngestMember && (
              <div className="flex items-center gap-2 text-sm">
                <Heart className="h-4 w-4 text-rose-500" />
                <span className="text-muted-foreground">Youngest member:</span>
                <span className="font-medium">{report.youngestMember.name}</span>
                {report.youngestMember.date && (
                  <Badge variant="outline" className="text-xs">
                    b. {new Date(report.youngestMember.date).getFullYear()}
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {report.milestoneEvents.length > 0 && (
        <Card data-testid="card-milestone-events">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Star className="h-4 w-4 text-amber-500" />
              Milestone Events
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {report.milestoneEvents.map((m, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <Star className="h-3.5 w-3.5 text-amber-400" />
                  <span className="font-medium">{m.event.title}</span>
                  {m.member && (
                    <span className="text-muted-foreground">
                      — {m.member.firstName} {m.member.lastName || ""}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
