import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Merge, ArrowRight, CheckCircle, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import type { FamilyMember } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface MemberMergeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberA: FamilyMember;
  memberB: FamilyMember;
  memberATreeName?: string;
  memberBTreeName?: string;
  onMergeComplete?: () => void;
}

interface MergeField {
  key: string;
  label: string;
  valueA: string | null;
  valueB: string | null;
  hasConflict: boolean;
}

const FIELD_LABELS: Record<string, string> = {
  firstName: "First Name",
  lastName: "Last Name",
  suffix: "Suffix",
  nickname: "Nickname",
  email: "Email",
  gender: "Gender",
  birthDate: "Birth Date",
  birthPlace: "Birth Place",
  deathDate: "Death Date",
  photoUrl: "Photo",
  notes: "Notes",
  currentCity: "Current City",
  currentRegion: "Current Region",
  currentCountry: "Current Country",
  isLiving: "Living Status",
};

export function MemberMergeDialog({
  open,
  onOpenChange,
  memberA,
  memberB,
  memberATreeName,
  memberBTreeName,
  onMergeComplete,
}: MemberMergeDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const mergeFields = useMemo(() => {
    const fields: MergeField[] = [];
    const fieldKeys = Object.keys(FIELD_LABELS);

    for (const key of fieldKeys) {
      const valA = (memberA as any)[key];
      const valB = (memberB as any)[key];
      const strA = valA != null && valA !== "" ? String(valA) : null;
      const strB = valB != null && valB !== "" ? String(valB) : null;

      if (!strA && !strB) continue;

      fields.push({
        key,
        label: FIELD_LABELS[key],
        valueA: strA,
        valueB: strB,
        hasConflict: strA !== null && strB !== null && strA !== strB,
      });
    }
    return fields;
  }, [memberA, memberB]);

  const conflictFields = mergeFields.filter(f => f.hasConflict);
  const onlyAFields = mergeFields.filter(f => f.valueA && !f.valueB);
  const onlyBFields = mergeFields.filter(f => !f.valueA && f.valueB);
  const sameFields = mergeFields.filter(f => f.valueA && f.valueB && !f.hasConflict);

  const initialChoices: Record<string, "a" | "b"> = {};
  for (const f of conflictFields) {
    initialChoices[f.key] = "a";
  }
  const [choices, setChoices] = useState<Record<string, "a" | "b">>(initialChoices);
  const [keepBothEmails, setKeepBothEmails] = useState(true);
  const [keepMember, setKeepMember] = useState<"a" | "b">("a");
  const [step, setStep] = useState<"pick-primary" | "resolve" | "confirm">("pick-primary");

  const keepId = keepMember === "a" ? memberA.id : memberB.id;
  const mergeId = keepMember === "a" ? memberB.id : memberA.id;

  const mergeMutation = useMutation({
    mutationFn: async () => {
      const resolvedFields: Record<string, any> = {};

      for (const f of onlyAFields) {
        const sourceVal = keepMember === "a" ? f.valueA : f.valueA;
        resolvedFields[f.key] = f.valueA;
      }
      for (const f of onlyBFields) {
        resolvedFields[f.key] = f.valueB;
      }
      for (const f of conflictFields) {
        const chosen = choices[f.key] || "a";
        resolvedFields[f.key] = chosen === "a" ? f.valueA : f.valueB;
      }

      if (keepBothEmails && memberA.email && memberB.email && memberA.email !== memberB.email) {
        const emailA = memberA.email;
        const emailB = memberB.email;
        resolvedFields.email = `${emailA}, ${emailB}`;
      }

      const response = await apiRequest("POST", "/api/members/merge-profiles", {
        keepMemberId: keepId,
        mergeMemberId: mergeId,
        resolvedFields,
      });
      return response.json();
    },
    onSuccess: (data: any) => {
      const transferSummary = Object.entries(data.transferResults || {})
        .filter(([, v]) => (v as number) > 0)
        .map(([k, v]) => `${v} ${k}`)
        .join(", ");
      toast({
        title: data.crossTree ? "Profiles synced!" : "Profiles merged!",
        description: data.crossTree
          ? `Both profiles updated with resolved data. ${transferSummary ? `Copied: ${transferSummary}.` : "All data preserved."} The merged view will show them as one person.`
          : `Successfully merged profiles. ${transferSummary || "All data preserved."}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/trees"] });
      queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      onOpenChange(false);
      onMergeComplete?.();
    },
    onError: (error: any) => {
      toast({
        title: "Merge failed",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const nameA = `${memberA.firstName} ${memberA.lastName || ""}`.trim();
  const nameB = `${memberB.firstName} ${memberB.lastName || ""}`.trim();
  const initialsA = `${memberA.firstName[0]}${memberA.lastName?.[0] || ""}`;
  const initialsB = `${memberB.firstName[0]}${memberB.lastName?.[0] || ""}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" data-testid="dialog-title-merge">
            <Merge className="h-5 w-5" />
            Merge Member Profiles
          </DialogTitle>
          <DialogDescription>
            Combine two profiles into one, keeping all data from both.
          </DialogDescription>
        </DialogHeader>

        {step === "pick-primary" && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Which profile should be the primary one? The other profile's data will be merged into it.
            </p>

            <RadioGroup value={keepMember} onValueChange={(v) => setKeepMember(v as "a" | "b")}>
              <div
                className={`flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                  keepMember === "a" ? "border-primary bg-primary/5" : "border-border"
                }`}
                onClick={() => setKeepMember("a")}
              >
                <RadioGroupItem value="a" id="keep-a" data-testid="radio-keep-a" />
                <Avatar className="h-12 w-12">
                  <AvatarImage src={memberA.photoUrl || undefined} />
                  <AvatarFallback className="bg-primary/10 font-serif">{initialsA}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <Label htmlFor="keep-a" className="text-base font-medium cursor-pointer">{nameA}</Label>
                  {memberATreeName && (
                    <p className="text-xs text-muted-foreground">From: {memberATreeName}</p>
                  )}
                  {memberA.email && <p className="text-xs text-muted-foreground">{memberA.email}</p>}
                </div>
                {keepMember === "a" && <Badge className="bg-primary">Primary</Badge>}
              </div>

              <div
                className={`flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                  keepMember === "b" ? "border-primary bg-primary/5" : "border-border"
                }`}
                onClick={() => setKeepMember("b")}
              >
                <RadioGroupItem value="b" id="keep-b" data-testid="radio-keep-b" />
                <Avatar className="h-12 w-12">
                  <AvatarImage src={memberB.photoUrl || undefined} />
                  <AvatarFallback className="bg-primary/10 font-serif">{initialsB}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <Label htmlFor="keep-b" className="text-base font-medium cursor-pointer">{nameB}</Label>
                  {memberBTreeName && (
                    <p className="text-xs text-muted-foreground">From: {memberBTreeName}</p>
                  )}
                  {memberB.email && <p className="text-xs text-muted-foreground">{memberB.email}</p>}
                </div>
                {keepMember === "b" && <Badge className="bg-primary">Primary</Badge>}
              </div>
            </RadioGroup>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-merge">
                Cancel
              </Button>
              <Button onClick={() => setStep(conflictFields.length > 0 ? "resolve" : "confirm")} className="gap-2" data-testid="button-next-step">
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "resolve" && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              These fields have different values. Choose which to keep for each:
            </p>

            <div className="space-y-3">
              {conflictFields.map((field) => (
                <div key={field.key} className="border rounded-lg p-3" data-testid={`merge-field-${field.key}`}>
                  <p className="text-sm font-medium mb-2">{field.label}</p>
                  <RadioGroup
                    value={choices[field.key] || "a"}
                    onValueChange={(v) => setChoices(prev => ({ ...prev, [field.key]: v as "a" | "b" }))}
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="a" id={`${field.key}-a`} data-testid={`radio-${field.key}-a`} />
                      <Label htmlFor={`${field.key}-a`} className="text-sm cursor-pointer flex-1">
                        <span className="text-foreground">{field.valueA}</span>
                        <span className="text-xs text-muted-foreground ml-1">({nameA})</span>
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="b" id={`${field.key}-b`} data-testid={`radio-${field.key}-b`} />
                      <Label htmlFor={`${field.key}-b`} className="text-sm cursor-pointer flex-1">
                        <span className="text-foreground">{field.valueB}</span>
                        <span className="text-xs text-muted-foreground ml-1">({nameB})</span>
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              ))}
            </div>

            {memberA.email && memberB.email && memberA.email !== memberB.email && (
              <div className="border rounded-lg p-3 bg-muted/30">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="keep-both-emails"
                    checked={keepBothEmails}
                    onCheckedChange={(v) => setKeepBothEmails(v === true)}
                    data-testid="checkbox-keep-both-emails"
                  />
                  <Label htmlFor="keep-both-emails" className="text-sm cursor-pointer">
                    Keep both email addresses ({memberA.email} and {memberB.email})
                  </Label>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("pick-primary")} className="gap-2" data-testid="button-back">
                <ChevronLeft className="h-4 w-4" /> Back
              </Button>
              <Button onClick={() => setStep("confirm")} className="gap-2" data-testid="button-next-confirm">
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "confirm" && (
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-center gap-4 py-4">
              <div className="text-center">
                <Avatar className="h-16 w-16 mx-auto mb-2">
                  <AvatarImage src={memberA.photoUrl || undefined} />
                  <AvatarFallback className="bg-primary/10 font-serif text-lg">{initialsA}</AvatarFallback>
                </Avatar>
                <p className="font-medium text-sm">{nameA}</p>
                {memberATreeName && <p className="text-xs text-muted-foreground">{memberATreeName}</p>}
              </div>
              <ArrowRight className="h-6 w-6 text-muted-foreground" />
              <div className="text-center">
                <Avatar className="h-16 w-16 mx-auto mb-2 ring-2 ring-primary">
                  <AvatarImage src={(keepMember === "a" ? memberA : memberB).photoUrl || undefined} />
                  <AvatarFallback className="bg-primary/10 font-serif text-lg">
                    {keepMember === "a" ? initialsA : initialsB}
                  </AvatarFallback>
                </Avatar>
                <p className="font-medium text-sm">{keepMember === "a" ? nameA : nameB}</p>
                <Badge variant="outline" className="text-xs mt-1">Merged</Badge>
              </div>
            </div>

            <div className="border rounded-lg p-4 space-y-2 text-sm">
              <p className="font-medium">Merge Summary:</p>
              {sameFields.length > 0 && (
                <p className="text-muted-foreground">
                  {sameFields.length} matching field{sameFields.length !== 1 ? "s" : ""} kept as-is
                </p>
              )}
              {onlyAFields.length > 0 && (
                <p className="text-muted-foreground">
                  {onlyAFields.length} field{onlyAFields.length !== 1 ? "s" : ""} from {nameA} will be added
                </p>
              )}
              {onlyBFields.length > 0 && (
                <p className="text-muted-foreground">
                  {onlyBFields.length} field{onlyBFields.length !== 1 ? "s" : ""} from {nameB} will be added
                </p>
              )}
              {conflictFields.length > 0 && (
                <p className="text-muted-foreground">
                  {conflictFields.length} conflict{conflictFields.length !== 1 ? "s" : ""} resolved by your choices
                </p>
              )}
              {keepBothEmails && memberA.email && memberB.email && memberA.email !== memberB.email && (
                <p className="text-muted-foreground">Both email addresses will be preserved</p>
              )}
              <p className="text-muted-foreground">
                All linked data (life events, education, career, voice notes, registries) will be transferred
              </p>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setStep(conflictFields.length > 0 ? "resolve" : "pick-primary")}
                className="gap-2"
                data-testid="button-back-confirm"
              >
                <ChevronLeft className="h-4 w-4" /> Back
              </Button>
              <Button
                onClick={() => mergeMutation.mutate()}
                disabled={mergeMutation.isPending}
                className="gap-2"
                data-testid="button-confirm-merge"
              >
                {mergeMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4" />
                )}
                {mergeMutation.isPending ? "Merging..." : "Merge Profiles"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
