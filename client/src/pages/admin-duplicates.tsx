import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, ArrowLeft, Users, CheckCircle2, Trash2,
  Calendar, MapPin, Mail, AlertTriangle, ChevronDown, ChevronUp,
  Copy, TreeDeciduous
} from "lucide-react";
import { Link } from "wouter";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader,
  DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

interface MemberVersion {
  id: string;
  treeId: string;
  treeName: string;
  firstName: string;
  lastName: string | null;
  suffix: string | null;
  nickname: string | null;
  email: string | null;
  gender: string | null;
  birthDate: string | null;
  birthPlace: string | null;
  deathDate: string | null;
  isLiving: boolean;
  photoUrl: string | null;
  notes: string | null;
  currentCity: string | null;
  currentRegion: string | null;
  currentCountry: string | null;
  relationshipCount: number;
  relationships: Array<{ type: string; qualifier: string | null; otherName: string }>;
}

interface DuplicateGroup {
  key: string;
  name: string;
  versions: MemberVersion[];
}

function formatDate(date: string | null | undefined) {
  if (!date) return null;
  try {
    return new Date(date + "T00:00:00").toLocaleDateString("en-US", {
      year: "numeric", month: "short", day: "numeric"
    });
  } catch { return date; }
}

function countFilledFields(m: MemberVersion): number {
  let count = 0;
  if (m.firstName) count++;
  if (m.lastName) count++;
  if (m.suffix) count++;
  if (m.nickname) count++;
  if (m.email) count++;
  if (m.gender) count++;
  if (m.birthDate) count++;
  if (m.birthPlace) count++;
  if (m.deathDate) count++;
  if (m.photoUrl) count++;
  if (m.notes) count++;
  if (m.currentCity) count++;
  if (m.currentRegion) count++;
  if (m.currentCountry) count++;
  return count;
}

function FieldRow({ label, values, fieldKey }: { label: string; values: (string | null | undefined)[]; fieldKey: string }) {
  const hasAny = values.some(v => v);
  if (!hasAny) return null;
  return (
    <div className="grid grid-cols-[120px,1fr] gap-2 py-1.5 border-b border-border/50 last:border-0">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex gap-2 flex-wrap">
        {values.map((v, i) => (
          <span key={i} className={`text-xs px-2 py-0.5 rounded ${v ? 'bg-primary/10 text-foreground font-medium' : 'text-muted-foreground/50 italic'}`}>
            {v || "—"}
          </span>
        ))}
      </div>
    </div>
  );
}

function DuplicateCard({ group, onResolved }: { group: DuplicateGroup; onResolved: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [keepId, setKeepId] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [syncFields, setSyncFields] = useState<Record<string, Record<string, string | null>>>({});
  const { toast } = useToast();

  const versions = group.versions;

  const bestVersion = useMemo(() => {
    let best = versions[0];
    let bestScore = countFilledFields(best) + best.relationshipCount;
    for (const v of versions) {
      const score = countFilledFields(v) + v.relationshipCount;
      if (score > bestScore) { best = v; bestScore = score; }
    }
    return best.id;
  }, [versions]);

  const selectedKeep = keepId || bestVersion;

  const syncMutation = useMutation({
    mutationFn: async ({ memberId, fields }: { memberId: string; fields: Record<string, any> }) => {
      return apiRequest("PATCH", `/api/admin/members/${memberId}/sync-fields`, fields);
    },
  });

  const mergeMutation = useMutation({
    mutationFn: async () => {
      const removeIds = versions.filter(v => v.id !== selectedKeep).map(v => v.id);
      const keepVersion = versions.find(v => v.id === selectedKeep)!;

      if (Object.keys(syncFields).length > 0 && syncFields[selectedKeep]) {
        await apiRequest("PATCH", `/api/admin/members/${selectedKeep}/sync-fields`, syncFields[selectedKeep]);
      }

      return apiRequest("POST", "/api/admin/duplicates/merge", {
        keepMemberId: selectedKeep,
        keepTreeId: keepVersion.treeId,
        removeMemberIds: removeIds,
      });
    },
    onSuccess: async (response: any) => {
      let detail = `Kept best version of ${group.name}, removed ${versions.length - 1} duplicate(s).`;
      try {
        const data = await response.json();
        if (data.relationshipsTransferred?.length > 0) {
          detail += ` Transferred ${data.relationshipsTransferred.length} relationship(s).`;
        }
        if (data.membersCopied?.length > 0) {
          detail += ` Copied ${data.membersCopied.length} member(s) into tree: ${data.membersCopied.join(', ')}.`;
        }
      } catch {}
      toast({ title: "Resolved", description: detail });
      setShowConfirm(false);
      onResolved();
    },
    onError: (error: Error) => {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    },
  });

  const handleFieldSync = (fieldKey: string, sourceVersion: MemberVersion) => {
    const value = (sourceVersion as any)[fieldKey];
    setSyncFields(prev => ({
      ...prev,
      [selectedKeep]: { ...(prev[selectedKeep] || {}), [fieldKey]: value }
    }));
    toast({ title: `"${fieldKey}" synced from ${sourceVersion.treeName}`, description: `This value will be copied to the kept version when you click Resolve.` });
  };

  const keepVersion = versions.find(v => v.id === selectedKeep);
  const removeVersions = versions.filter(v => v.id !== selectedKeep);

  const fields: { key: string; label: string }[] = [
    { key: "firstName", label: "First Name" },
    { key: "lastName", label: "Last Name" },
    { key: "suffix", label: "Suffix" },
    { key: "nickname", label: "Nickname" },
    { key: "email", label: "Email" },
    { key: "gender", label: "Gender" },
    { key: "birthDate", label: "Birth Date" },
    { key: "birthPlace", label: "Birth Place" },
    { key: "deathDate", label: "Death Date" },
    { key: "photoUrl", label: "Photo" },
    { key: "currentCity", label: "City" },
    { key: "currentRegion", label: "Region" },
    { key: "currentCountry", label: "Country" },
    { key: "notes", label: "Notes" },
  ];

  return (
    <>
      <Card className="overflow-hidden" data-testid={`duplicate-group-${group.key}`}>
        <CardHeader
          className="cursor-pointer hover:bg-muted/50 transition-colors pb-3"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={versions.find(v => v.photoUrl)?.photoUrl || undefined} />
                <AvatarFallback className="text-sm">
                  {group.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-base">{group.name}</CardTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className="text-xs">
                    {versions.length} versions
                  </Badge>
                  {versions.map(v => (
                    <Badge key={v.id} variant="outline" className="text-[10px]">
                      {v.treeName}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </div>
        </CardHeader>

        {expanded && (
          <CardContent className="pt-0 space-y-4">
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${versions.length}, 1fr)` }}>
              {versions.map(v => (
                <Card
                  key={v.id}
                  className={`relative cursor-pointer transition-all ${
                    v.id === selectedKeep
                      ? 'ring-2 ring-primary bg-primary/5'
                      : 'hover:bg-muted/30 opacity-75'
                  }`}
                  onClick={() => setKeepId(v.id)}
                  data-testid={`version-card-${v.id}`}
                >
                  {v.id === selectedKeep && (
                    <div className="absolute top-2 right-2">
                      <Badge className="text-[10px] bg-primary">KEEP</Badge>
                    </div>
                  )}
                  {v.id !== selectedKeep && (
                    <div className="absolute top-2 right-2">
                      <Badge variant="destructive" className="text-[10px]">REMOVE</Badge>
                    </div>
                  )}
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={v.photoUrl || undefined} />
                        <AvatarFallback className="text-xs">
                          {v.firstName[0]}{v.lastName?.[0] || ''}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {v.firstName} {v.lastName || ''}
                        </p>
                        <div className="flex items-center gap-1">
                          <TreeDeciduous className="h-3 w-3 text-muted-foreground" />
                          <span className="text-[10px] text-muted-foreground truncate">{v.treeName}</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Data fields:</span>
                        <span className="font-medium">{countFilledFields(v)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Relationships:</span>
                        <span className="font-medium">{v.relationshipCount}</span>
                      </div>
                    </div>

                    {v.email && (
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Mail className="h-3 w-3" />
                        <span className="truncate">{v.email}</span>
                      </div>
                    )}
                    {v.birthDate && (
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {formatDate(v.birthDate)}
                      </div>
                    )}
                    {v.birthPlace && (
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        <span className="truncate">{v.birthPlace}</span>
                      </div>
                    )}

                    {v.relationships.length > 0 && (
                      <div className="pt-1 space-y-0.5">
                        <p className="text-[10px] font-medium text-muted-foreground">Relationships:</p>
                        {v.relationships.slice(0, 5).map((r, i) => (
                          <Badge key={i} variant="secondary" className="text-[9px] mr-0.5 mb-0.5">
                            {r.type}{r.qualifier ? ` (${r.qualifier})` : ''}: {r.otherName}
                          </Badge>
                        ))}
                        {v.relationships.length > 5 && (
                          <span className="text-[9px] text-muted-foreground">+{v.relationships.length - 5} more</span>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="border rounded-lg p-3">
              <p className="text-sm font-medium mb-1">Field-by-field comparison</p>
              <p className="text-xs text-muted-foreground mb-3">Click any value from a REMOVE column to copy it to the KEEP version. Synced fields show a green highlight.</p>
              <div className="space-y-0">
                {fields.map(f => {
                  const vals = versions.map(v => (v as any)[f.key]);
                  const hasAny = vals.some(v => v);
                  const hasDiff = new Set(vals.filter(v => v).map(v => String(v))).size > 1;
                  if (!hasAny) return null;
                  const keepVal = (versions.find(v => v.id === selectedKeep) as any)?.[f.key];
                  return (
                    <div key={f.key} className={`grid gap-2 py-2 border-b border-border/40 last:border-0 ${hasDiff ? 'bg-amber-50 dark:bg-amber-900/10 px-2 -mx-2 rounded' : ''}`}
                      style={{ gridTemplateColumns: `100px repeat(${versions.length}, 1fr)` }}
                    >
                      <span className="text-xs font-medium text-muted-foreground flex items-center">
                        {f.label}
                        {hasDiff && <AlertTriangle className="h-3 w-3 text-amber-500 ml-1" />}
                      </span>
                      {versions.map(v => {
                        const val = (v as any)[f.key];
                        const isSynced = syncFields[selectedKeep]?.[f.key] !== undefined && syncFields[selectedKeep][f.key] === val;
                        const isKeep = v.id === selectedKeep;
                        const canSync = !isKeep && val;
                        const displayVal = f.key === 'photoUrl'
                          ? (val ? <Avatar className="h-8 w-8"><AvatarImage src={val} /><AvatarFallback>?</AvatarFallback></Avatar> : "—")
                          : (f.key === 'birthDate' || f.key === 'deathDate')
                            ? (formatDate(val) || "—")
                            : (val || "—");
                        return (
                          <div
                            key={v.id}
                            className={`relative text-left text-xs px-2 py-1.5 rounded transition-all ${
                              isSynced
                                ? 'bg-green-100 dark:bg-green-900/30 ring-2 ring-green-500 font-medium'
                                : isKeep
                                  ? 'bg-primary/5 font-medium border border-primary/20'
                                  : canSync
                                    ? 'hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:ring-2 hover:ring-blue-400 cursor-pointer border border-transparent hover:border-blue-300'
                                    : 'text-muted-foreground/50'
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (canSync) {
                                handleFieldSync(f.key, v);
                              }
                            }}
                            role={canSync ? "button" : undefined}
                            tabIndex={canSync ? 0 : undefined}
                            data-testid={`sync-field-${f.key}-${v.id}`}
                          >
                            {displayVal}
                            {isSynced && (
                              <span className="absolute -top-1 -right-1 bg-green-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[9px]">✓</span>
                            )}
                            {canSync && !isSynced && (
                              <span className="absolute -top-1 -right-1 bg-blue-400 text-white rounded-full w-4 h-4 flex items-center justify-center text-[9px] opacity-0 group-hover:opacity-100">
                                <Copy className="h-2.5 w-2.5" />
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-muted-foreground">
                Click a version card to select which one to keep. Click individual field values to sync them.
              </p>
              <Button
                onClick={() => setShowConfirm(true)}
                data-testid={`button-resolve-${group.key}`}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Resolve ({removeVersions.length} to remove)
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent data-testid="dialog-confirm-resolve">
          <DialogHeader>
            <DialogTitle>Confirm Resolution</DialogTitle>
            <DialogDescription>
              This will keep the version of {group.name} from "{keepVersion?.treeName}" and soft-delete {removeVersions.length} duplicate(s).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span className="text-sm">
                <strong>Keep:</strong> {keepVersion?.firstName} {keepVersion?.lastName} from {keepVersion?.treeName}
                ({keepVersion?.relationshipCount} relationships, {keepVersion ? countFilledFields(keepVersion) : 0} fields)
              </span>
            </div>
            {Object.keys(syncFields[selectedKeep] || {}).length > 0 && (
              <div className="flex items-center gap-2">
                <Copy className="h-4 w-4 text-blue-500" />
                <span className="text-sm">
                  <strong>Sync fields:</strong> {Object.keys(syncFields[selectedKeep]).join(", ")}
                </span>
              </div>
            )}
            {removeVersions.map(v => (
              <div key={v.id} className="flex items-center gap-2">
                <Trash2 className="h-4 w-4 text-destructive" />
                <span className="text-sm">
                  <strong>Remove:</strong> {v.firstName} {v.lastName} from {v.treeName}
                  ({v.relationshipCount} relationships)
                </span>
              </div>
            ))}

            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg mt-2">
              <p className="text-sm font-medium text-blue-800 dark:text-blue-200 flex items-center gap-2">
                <ArrowLeft className="h-4 w-4 rotate-180" />
                Relationships will be transferred
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                All {removeVersions.reduce((sum, v) => sum + v.relationshipCount, 0)} relationship(s) from the removed versions will be automatically transferred to the kept version.
                Any related members not already in "{keepVersion?.treeName}" will be copied in.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)} data-testid="button-cancel-resolve">
              Cancel
            </Button>
            <Button
              onClick={() => mergeMutation.mutate()}
              disabled={mergeMutation.isPending}
              data-testid="button-confirm-resolve"
            >
              {mergeMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function AdminDuplicates() {
  const { toast } = useToast();

  const { data: isAdmin, isLoading: checkingAdmin } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["/api/admin/check"],
  });

  const { data: duplicates = [], isLoading, refetch } = useQuery<DuplicateGroup[]>({
    queryKey: ["/api/admin/duplicates"],
    queryFn: async () => {
      const res = await fetch("/api/admin/duplicates", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load duplicates");
      return res.json();
    },
    enabled: isAdmin?.isAdmin === true,
  });

  if (checkingAdmin || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Finding duplicates across your trees...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin?.isAdmin) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Access Denied
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard">
              <Button data-testid="button-back-dashboard">
                <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="mb-6">
        <Link href="/dashboard">
          <Button variant="ghost" size="sm" data-testid="button-back-dashboard">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Duplicate Manager
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            People who appear in multiple trees. Compare side by side, sync fields, then resolve by keeping the best version.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="text-sm">
              {duplicates.length} duplicate group{duplicates.length !== 1 ? 's' : ''} found
            </Badge>
            <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-refresh-duplicates">
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {duplicates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="h-12 w-12 text-primary mx-auto mb-3" />
            <p className="text-lg font-medium">No duplicates found</p>
            <p className="text-sm text-muted-foreground">All members across your trees are unique.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {duplicates.map(group => (
            <DuplicateCard
              key={group.key}
              group={group}
              onResolved={() => {
                queryClient.invalidateQueries({ queryKey: ["/api/admin/duplicates"] });
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
