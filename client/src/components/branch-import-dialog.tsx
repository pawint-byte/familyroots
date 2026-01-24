import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Users, User, ArrowRight, DollarSign, Check, AlertCircle } from "lucide-react";

interface ImportPreviewMember {
  id: string;
  firstName: string;
  lastName: string | null;
  photoUrl: string | null;
}

interface ImportPreviewData {
  sourceTree: { id: string; name: string };
  rootMember: { id: string; firstName: string; lastName: string | null };
  scope: string;
  membersToImport: ImportPreviewMember[];
  memberCount: number;
  pricingImpact: {
    currentTotal: number;
    newTotal: number;
    currentTier: { price: number; label: string };
    newTier: { price: number; label: string };
    tierChange: boolean;
  };
}

interface BranchImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  treeId: string;
  connectionId: string;
  connectorMemberId?: string;
  sourceTreeName?: string;
}

type ImportScope = "single" | "immediate_family" | "descendants" | "ancestors";

export function BranchImportDialog({
  isOpen,
  onClose,
  treeId,
  connectionId,
  connectorMemberId,
  sourceTreeName
}: BranchImportDialogProps) {
  const { toast } = useToast();
  const [scope, setScope] = useState<ImportScope>("immediate_family");
  const [includeSpouses, setIncludeSpouses] = useState(true);
  const [includeParents, setIncludeParents] = useState(false);
  const [includeChildren, setIncludeChildren] = useState(true);

  const effectiveIncludeParents = scope === "ancestors" ? true : includeParents;
  const effectiveIncludeChildren = scope === "descendants" ? true : includeChildren;

  const previewQueryString = new URLSearchParams({
    rootMemberId: connectorMemberId || "",
    scope,
    includeSpouses: includeSpouses.toString(),
    includeParents: effectiveIncludeParents.toString(),
    includeChildren: effectiveIncludeChildren.toString()
  }).toString();

  const { data: preview, isLoading: isPreviewLoading } = useQuery<ImportPreviewData>({
    queryKey: ["/api/trees", treeId, "connections", connectionId, "import-preview", previewQueryString],
    queryFn: async () => {
      const response = await fetch(
        `/api/trees/${treeId}/connections/${connectionId}/import-preview?${previewQueryString}`,
        { credentials: "include" }
      );
      if (!response.ok) throw new Error("Failed to fetch preview");
      return response.json();
    },
    enabled: isOpen && !!connectorMemberId
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/trees/${treeId}/connections/${connectionId}/import`, {
        rootMemberId: connectorMemberId,
        scope,
        includeSpouses,
        includeParents: effectiveIncludeParents,
        includeChildren: effectiveIncludeChildren
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Branch imported successfully",
        description: `Imported ${data.importedCount} family members`
      });
      queryClient.invalidateQueries({ queryKey: ["/api/trees", treeId] });
      onClose();
    },
    onError: () => {
      toast({
        title: "Import failed",
        description: "Could not import the selected branch",
        variant: "destructive"
      });
    }
  });

  const getScopeDescription = (s: ImportScope) => {
    switch (s) {
      case "single": return "Just this person";
      case "immediate_family": return "Parents, siblings, spouse, and children";
      case "descendants": return "This person and all their descendants";
      case "ancestors": return "This person and all their ancestors";
      default: return "";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" data-testid="dialog-branch-import">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Import Branch from {sourceTreeName || "Connected Tree"}
          </DialogTitle>
          <DialogDescription>
            Choose which family members to import. Imported members count toward your subscription and get full features.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-6 py-4">
          <div className="space-y-3">
            <Label className="text-sm font-medium">Import Scope</Label>
            <RadioGroup value={scope} onValueChange={(v) => setScope(v as ImportScope)} className="space-y-2">
              <div className="flex items-center space-x-3 p-3 rounded-lg border hover-elevate cursor-pointer" onClick={() => setScope("single")}>
                <RadioGroupItem value="single" id="single" data-testid="radio-scope-single" />
                <div className="flex-1">
                  <Label htmlFor="single" className="font-medium cursor-pointer">Single Person</Label>
                  <p className="text-xs text-muted-foreground">{getScopeDescription("single")}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3 p-3 rounded-lg border hover-elevate cursor-pointer" onClick={() => setScope("immediate_family")}>
                <RadioGroupItem value="immediate_family" id="immediate_family" data-testid="radio-scope-immediate" />
                <div className="flex-1">
                  <Label htmlFor="immediate_family" className="font-medium cursor-pointer">Immediate Family</Label>
                  <p className="text-xs text-muted-foreground">{getScopeDescription("immediate_family")}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3 p-3 rounded-lg border hover-elevate cursor-pointer" onClick={() => setScope("descendants")}>
                <RadioGroupItem value="descendants" id="descendants" data-testid="radio-scope-descendants" />
                <div className="flex-1">
                  <Label htmlFor="descendants" className="font-medium cursor-pointer">Descendants</Label>
                  <p className="text-xs text-muted-foreground">{getScopeDescription("descendants")}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3 p-3 rounded-lg border hover-elevate cursor-pointer" onClick={() => setScope("ancestors")}>
                <RadioGroupItem value="ancestors" id="ancestors" data-testid="radio-scope-ancestors" />
                <div className="flex-1">
                  <Label htmlFor="ancestors" className="font-medium cursor-pointer">Ancestors</Label>
                  <p className="text-xs text-muted-foreground">{getScopeDescription("ancestors")}</p>
                </div>
              </div>
            </RadioGroup>
          </div>

          {scope !== "single" && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Include Options</Label>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <Label htmlFor="include-spouses" className="cursor-pointer">Include spouses</Label>
                  <Switch
                    id="include-spouses"
                    checked={includeSpouses}
                    onCheckedChange={setIncludeSpouses}
                    data-testid="switch-include-spouses"
                  />
                </div>
                {(scope === "immediate_family" || scope === "ancestors") && (
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <Label htmlFor="include-parents" className="cursor-pointer">Include parents</Label>
                    <Switch
                      id="include-parents"
                      checked={scope === "ancestors" ? true : includeParents}
                      onCheckedChange={scope === "ancestors" ? undefined : setIncludeParents}
                      disabled={scope === "ancestors"}
                      data-testid="switch-include-parents"
                    />
                  </div>
                )}
                {(scope === "immediate_family" || scope === "descendants") && (
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <Label htmlFor="include-children" className="cursor-pointer">Include children</Label>
                    <Switch
                      id="include-children"
                      checked={scope === "descendants" ? true : includeChildren}
                      onCheckedChange={scope === "descendants" ? undefined : setIncludeChildren}
                      disabled={scope === "descendants"}
                      data-testid="switch-include-children"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {isPreviewLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : preview ? (
            <>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Users className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{preview.memberCount} members to import</p>
                        <p className="text-sm text-muted-foreground">From {preview.sourceTree.name}</p>
                      </div>
                    </div>
                    {preview.pricingImpact.tierChange ? (
                      <Badge variant="secondary" className="gap-1">
                        <DollarSign className="h-3 w-3" />
                        {preview.pricingImpact.currentTier.label} <ArrowRight className="h-3 w-3" /> {preview.pricingImpact.newTier.label}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1">
                        <Check className="h-3 w-3" />
                        No tier change
                      </Badge>
                    )}
                  </div>

                  <div className="mt-4 flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Current:</span>
                      <span className="font-medium">{preview.pricingImpact.currentTotal} members</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">After import:</span>
                      <span className="font-medium">{preview.pricingImpact.newTotal} members</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Members to Import</Label>
                <ScrollArea className="h-40 rounded-lg border p-2">
                  <div className="grid grid-cols-2 gap-2">
                    {preview.membersToImport.map((member) => (
                      <div key={member.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={member.photoUrl || undefined} />
                          <AvatarFallback>
                            <User className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm truncate">
                          {member.firstName} {member.lastName || ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {preview.pricingImpact.newTotal >= 100 && preview.pricingImpact.currentTotal < 100 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Congratulations! This import will bring you to 100+ members, making your subscription FREE!
                  </AlertDescription>
                </Alert>
              )}
            </>
          ) : !connectorMemberId ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Unable to preview import - no connector member found for this tree connection.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Select import options to preview members</p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-import">
            Cancel
          </Button>
          <Button
            onClick={() => importMutation.mutate()}
            disabled={!preview || preview.memberCount === 0 || importMutation.isPending}
            data-testid="button-confirm-import"
          >
            {importMutation.isPending ? "Importing..." : `Import ${preview?.memberCount || 0} Members`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
