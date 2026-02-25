import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { RefreshCw, Check, X, ArrowRight } from "lucide-react";

interface PoolUpdate {
  id: string;
  sourceMemberName: string;
  localMemberName: string;
  sourceTreeName: string;
  localTreeName: string;
  changedByName: string;
  changedFields: Record<string, { old: string | null; new: string | null }>;
  createdAt: string;
}

const fieldLabels: Record<string, string> = {
  firstName: "First name",
  lastName: "Last name",
  birthDate: "Birth date",
  deathDate: "Death date",
  birthPlace: "Birthplace",
  gender: "Gender",
  photoUrl: "Photo",
  isLiving: "Living status",
};

export function PoolUpdates() {
  const { toast } = useToast();

  const { data: updates, isLoading } = useQuery<PoolUpdate[]>({
    queryKey: ["/api/pool-updates"],
    queryFn: async () => {
      const response = await fetch("/api/pool-updates", { credentials: "include" });
      if (!response.ok) return [];
      return response.json();
    },
    refetchInterval: 60000,
  });

  const acceptMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("PATCH", `/api/pool-updates/${id}/accept`);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/pool-updates"] });
      toast({
        title: "Update accepted",
        description: `Updated ${(data.updatedFields || []).length} field(s)`,
      });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("PATCH", `/api/pool-updates/${id}/dismiss`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pool-updates"] });
    },
  });

  if (isLoading || !updates || updates.length === 0) return null;

  return (
    <Card data-testid="card-pool-updates">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <RefreshCw className="h-4 w-4" />
          Family Pool Updates
          <Badge variant="secondary" className="ml-auto">{updates.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {updates.slice(0, 5).map((update) => (
          <div key={update.id} className="border rounded-lg p-3 space-y-2" data-testid={`pool-update-${update.id}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium" data-testid={`text-update-member-${update.id}`}>
                  {update.sourceMemberName}
                </p>
                <p className="text-xs text-muted-foreground">
                  Updated by {update.changedByName} in {update.sourceTreeName}
                </p>
              </div>
            </div>
            <div className="space-y-1">
              {Object.entries(update.changedFields).map(([field, change]) => (
                <div key={field} className="flex items-center gap-1.5 text-xs">
                  <span className="text-muted-foreground min-w-[80px]">{fieldLabels[field] || field}:</span>
                  <span className="text-red-500 line-through truncate max-w-[80px]">{change.old || '(empty)'}</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  <span className="text-green-600 font-medium truncate max-w-[80px]">{change.new || '(empty)'}</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground">
              Your copy: {update.localMemberName} in {update.localTreeName}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1 h-7 text-xs"
                onClick={() => acceptMutation.mutate(update.id)}
                disabled={acceptMutation.isPending}
                data-testid={`button-accept-update-${update.id}`}
              >
                <Check className="h-3 w-3" />
                Accept changes
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 h-7 text-xs"
                onClick={() => dismissMutation.mutate(update.id)}
                disabled={dismissMutation.isPending}
                data-testid={`button-dismiss-update-${update.id}`}
              >
                <X className="h-3 w-3" />
                Keep mine
              </Button>
            </div>
          </div>
        ))}
        {updates.length > 5 && (
          <p className="text-xs text-muted-foreground text-center">
            +{updates.length - 5} more updates
          </p>
        )}
      </CardContent>
    </Card>
  );
}
