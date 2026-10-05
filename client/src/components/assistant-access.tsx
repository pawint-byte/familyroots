import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { AssistantActionView, AssistantKeyView, AssistantScope, AssistantSettings } from "@shared/assistant";
import { ASSISTANT_SCOPES } from "@shared/assistant";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, Check, Clipboard, Clock3, KeyRound, Loader2, LockKeyhole, ShieldCheck, X } from "lucide-react";

const SETTINGS_URL = "/api/agent/settings";

const SCOPE_LABELS: Record<AssistantScope, string> = {
  "people:add": "Draft a person for my review",
  "labels:set": "Set relationship labels",
  "invite:send": "Send family invitations",
  "email:send": "Send email on my behalf",
  "people:merge": "Merge duplicate profiles",
};

type Candidate = { id: string; name: string };

function pretty(value: string) {
  return value.replace(/[_:]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function dateLabel(value: string | null) {
  if (!value) return "Not yet";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function candidatesFrom(action: AssistantActionView): Candidate[] {
  const result = action.result as Record<string, unknown> | null;
  const source = result?.candidates;
  if (!Array.isArray(source)) return [];
  return source.flatMap((item: unknown) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const id = record.id ?? record.memberId;
    const name = record.name ?? record.label ?? record.email;
    return id != null ? [{ id: String(id), name: String(name ?? id) }] : [];
  });
}

function isAmbiguous(action: AssistantActionView, candidates: Candidate[]) {
  const result = action.result as Record<string, unknown> | null;
  return !!result?.selectionField || !!result?.candidateGroups || candidates.length > 1;
}

function mergeCandidates(action: AssistantActionView, field: "keepMemberId" | "mergeMemberId"): Candidate[] {
  const result = action.result as Record<string, unknown> | null;
  const groups = result?.candidateGroups as Record<string, unknown> | undefined;
  const source = groups?.[field];
  if (!Array.isArray(source)) return [];
  return source.flatMap((item: unknown) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const id = record.id;
    return id == null ? [] : [{ id: String(id), name: String(record.name ?? id) }];
  });
}

function resultRecord(action: AssistantActionView): Record<string, unknown> {
  return (action.result ?? {}) as Record<string, unknown>;
}

function describeRecord(value: unknown) {
  if (value == null) return "No details supplied.";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function AssistantReviewReminder() {
  const { user } = useAuth();
  const { data } = useQuery<AssistantSettings>({
    queryKey: [SETTINGS_URL],
    enabled: !!user,
  });
  const needsReview = data?.keys.some((key) => key.state === "review_due" || key.state === "paused");
  if (!user || !needsReview) return null;
  return (
    <a
      href="/account/settings"
      className="fixed bottom-4 right-4 z-40 flex max-w-sm items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950 shadow-lg transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
      data-testid="assistant-review-reminder"
    >
      <Clock3 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <span>
        <span className="block font-semibold">Assistant access needs review</span>
        <span className="mt-0.5 block text-sm opacity-80">Review or renew your permissions in settings.</span>
      </span>
    </a>
  );
}

export function AssistantAccess() {
  const { toast } = useToast();
  const { data, isLoading, isError, refetch } = useQuery<AssistantSettings>({
    queryKey: [SETTINGS_URL],
  });
  const [name, setName] = useState("");
  const [treeId, setTreeId] = useState("");
  const [memberId, setMemberId] = useState("");
  const [createPending, setCreatePending] = useState(false);
  const [scopes, setScopes] = useState<AssistantScope[]>([...ASSISTANT_SCOPES]);
  const [token, setToken] = useState("");
  const [openApproval, setOpenApproval] = useState<string | null>(null);
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [keepMember, setKeepMember] = useState<Record<string, string>>({});
  const [mergeMember, setMergeMember] = useState<Record<string, string>>({});
  const [acknowledged, setAcknowledged] = useState<Record<string, boolean>>({});

  const selectedTree = data?.trees.find((tree) => tree.id === treeId);
  const availableMembers = selectedTree?.members.filter((member) => member.claimedByMe) ?? [];
  const sortedActions = useMemo(
    () => [...(data?.actions ?? [])].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
    [data?.actions],
  );

  const refresh = () => queryClient.invalidateQueries({ queryKey: [SETTINGS_URL] });
  const refreshTreeAndMemberData = () => queryClient.invalidateQueries({
    predicate: (query) => query.queryKey.some((part) => typeof part === "string" && /tree|member/i.test(part)),
  });
  const revokeKey = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/agent/keys/${encodeURIComponent(id)}`),
    onSuccess: () => {
      toast({ title: "Access revoked", description: "This key can no longer act on your behalf." });
      refresh();
    },
    onError: (error: Error) => toast({ title: "Could not revoke access", description: error.message, variant: "destructive" }),
  });
  const reviewKey = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: "renew" | "extend" | "stop" }) =>
      apiRequest("POST", `/api/agent/keys/${encodeURIComponent(id)}/review`, { decision }),
    onSuccess: (_, variables) => {
      const descriptions = { renew: "Access renewed for 30 days.", extend: "Review window extended by 7 days.", stop: "Write access is paused." };
      toast({ title: "Review saved", description: descriptions[variables.decision] });
      refresh();
    },
    onError: (error: Error) => toast({ title: "Could not update review", description: error.message, variant: "destructive" }),
  });
  const decideAction = useMutation({
    mutationFn: ({ action, decision, body }: { action: AssistantActionView; decision: "approve" | "reject"; body: Record<string, unknown> }) =>
      apiRequest("POST", `/api/agent/actions/${encodeURIComponent(action.id)}/${decision}`, body),
    onSuccess: (_, variables) => {
      setOpenApproval(null);
      toast({ title: variables.decision === "approve" ? "Task approved" : "Task rejected", description: "Your action list has been updated." });
      refresh();
      refreshTreeAndMemberData();
    },
    onError: (error: Error, variables) => {
      if (variables.decision === "approve" && /^409\b/.test(error.message)) {
        setSelection((current) => ({ ...current, [variables.action.id]: "" }));
        setKeepMember((current) => ({ ...current, [variables.action.id]: "" }));
        setMergeMember((current) => ({ ...current, [variables.action.id]: "" }));
        refresh();
      }
      toast({ title: "Could not update task", description: error.message, variant: "destructive" });
    },
  });

  async function copyToken() {
    try {
      await navigator.clipboard.writeText(token);
      toast({ title: "Key copied", description: "Store it in your AI tool's secure credential settings." });
    } catch {
      toast({ title: "Copy failed", description: "Your browser blocked clipboard access. Select and copy the key manually.", variant: "destructive" });
    }
  }

  function toggleScope(scope: AssistantScope, checked: boolean) {
    setScopes((current) => checked ? [...new Set([...current, scope])] : current.filter((item) => item !== scope));
  }

  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || !treeId || createPending) return;
    if (memberId && !availableMembers.some((member) => member.id === memberId)) {
      setMemberId("");
      toast({ title: "Choose a profile you control", description: "Profile-specific access is available only for a profile claimed by you.", variant: "destructive" });
      return;
    }
    setCreatePending(true);
    try {
      const response = await apiRequest("POST", "/api/agent/keys", {
        name: name.trim(),
        treeId,
        ...(memberId ? { memberId } : {}),
        scopes,
      });
      const result = await response.json() as { key: AssistantKeyView; token: string };
      // Do not return the secret through React Query or place it in persistent storage.
      setToken(result.token);
      setName("");
      toast({ title: "Assistant access created", description: "Copy this key now. It will not be shown again." });
      refresh();
    } catch (error) {
      toast({ title: "Could not create access", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setCreatePending(false);
    }
  }

  function approve(action: AssistantActionView) {
    const result = resultRecord(action);
    const isDraftPerson = action.status === "draft" && action.action === "people:add";
    const isPendingPersonAnchor = action.status === "pending_confirmation" && action.action === "people:add";
    const selectionField = String(result.selectionField ?? "");
    const isMerge = action.action === "people:merge" || action.action === "merge" || !!result.candidateGroups;
    const needsBulkConfirmation = action.action === "delete_all" || action.action === "email_all";
    const hasEmailMismatch = action.action === "email:send" && result.recipient != null && result.message != null;
    const body: Record<string, unknown> = isDraftPerson ? {} : { confirmed: true };

    if (!isDraftPerson && isMerge) {
      const keepOptions = mergeCandidates(action, "keepMemberId");
      const mergeOptions = mergeCandidates(action, "mergeMemberId");
      const keep = keepOptions.length === 1 ? keepOptions[0].id : keepMember[action.id];
      const merge = mergeOptions.length === 1 ? mergeOptions[0].id : mergeMember[action.id];
      if (!keep || !merge || keep === merge) {
        toast({ title: "Choose both profiles", description: "Select the profile to keep and the duplicate to merge.", variant: "destructive" });
        return;
      }
      body.keepMemberId = keep;
      body.mergeMemberId = merge;
    } else if (!isDraftPerson && (isPendingPersonAnchor || selectionField === "of")) {
      const anchor = selection[action.id];
      if (!anchor) {
        toast({ title: "Choose a family anchor", description: "Select a profile claimed by you to anchor this action.", variant: "destructive" });
        return;
      }
      body.of = anchor;
    } else if (!isDraftPerson && selectionField === "memberId") {
      if (!selection[action.id]) {
        toast({ title: "Choose a person", description: "Select the intended recipient or profile before approving.", variant: "destructive" });
        return;
      }
      body.memberId = selection[action.id];
    }

    if ((needsBulkConfirmation && !acknowledged[`${action.id}:bulk`]) || (hasEmailMismatch && !acknowledged[`${action.id}:email`])) {
      toast({ title: "Confirmation required", description: "Review the warning and explicitly confirm before approving.", variant: "destructive" });
      return;
    }
    decideAction.mutate({ action, decision: "approve", body });
  }

  if (isLoading) {
    return (
      <section className="space-y-4" aria-label="Assistant access loading">
        <div className="h-36 animate-pulse rounded-2xl bg-muted" />
        <div className="h-52 animate-pulse rounded-2xl bg-muted" />
      </section>
    );
  }

  if (isError || !data) {
    return (
      <Alert variant="destructive" className="rounded-2xl">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Assistant access is unavailable</AlertTitle>
        <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
          We couldn’t load your permissions. Your existing account settings are unchanged.
          <Button variant="outline" size="sm" onClick={() => refetch()}>Try again</Button>
        </AlertDescription>
      </Alert>
    );
  }

  const activeCount = data.keys.filter((key) => key.state === "active").length;
  const pendingActions = sortedActions.filter((action) => action.status === "pending_confirmation" || action.status === "draft");
  const historyActions = sortedActions.filter((action) => !pendingActions.includes(action));

  return (
    <section className="space-y-6" aria-labelledby="assistant-access-title">
      <Card className="overflow-hidden rounded-2xl border-border/80 shadow-sm">
        <div className="bg-[linear-gradient(120deg,hsl(var(--primary)/.10),transparent_62%)]">
          <CardHeader className="pb-4">
            <div className="flex items-start gap-3">
              <span className="rounded-xl border bg-background p-2.5 text-primary"><LockKeyhole className="h-5 w-5" /></span>
              <div className="flex-1">
                <CardTitle id="assistant-access-title" className="text-xl">Your AI, under your direction</CardTitle>
                <CardDescription className="mt-1 max-w-2xl leading-relaxed">
                  Give an AI tool a revocable key for specific family-tree tasks. FamilyRoots does not host a chatbot; you choose the tool, the scope, and what gets approved.
                </CardDescription>
              </div>
              <div className="hidden rounded-full border bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground sm:block">
                {activeCount} active {activeCount === 1 ? "key" : "keys"}
              </div>
            </div>
          </CardHeader>
        </div>
        <CardContent className="space-y-5">
          <Alert className="border-primary/20 bg-primary/[0.035]">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <AlertTitle>Secure setup, on your terms</AlertTitle>
            <AlertDescription>
              Add the key to your AI client’s secure tool credentials; never paste it into a prompt or share it with anyone. No FamilyRoots password is needed. Tool support for authenticated HTTP tools varies—check your client’s documentation first.
            </AlertDescription>
          </Alert>

          {token && (
            <div className="rounded-xl border border-emerald-700/25 bg-emerald-50 p-4 dark:bg-emerald-950/35" data-testid="assistant-key-token">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-emerald-950 dark:text-emerald-100">Copy your key now</p>
                  <p className="mt-1 text-sm text-emerald-900/80 dark:text-emerald-200/80">This is the only time it will be shown. Dismissing this panel makes it unavailable.</p>
                </div>
                <Button size="sm" variant="outline" onClick={copyToken} data-testid="button-copy-assistant-token">
                  <Clipboard className="mr-2 h-4 w-4" /> Copy key
                </Button>
              </div>
              <div className="mt-3 flex gap-2">
                <Input aria-label="New assistant access key, shown once" value={token} readOnly className="font-mono text-xs" />
                <Button variant="ghost" size="icon" aria-label="Dismiss key" onClick={() => setToken("")}><X className="h-4 w-4" /></Button>
              </div>
            </div>
          )}

          <form className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(250px,.8fr)]" onSubmit={submitCreate}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="assistant-name">Name this access key</Label>
                <Input id="assistant-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="For example, my research assistant" maxLength={80} required data-testid="input-assistant-key-name" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="assistant-tree">Family tree</Label>
                  <Select value={treeId} onValueChange={(value) => { setTreeId(value); setMemberId(""); }}>
                    <SelectTrigger id="assistant-tree" data-testid="select-assistant-tree"><SelectValue placeholder="Choose a tree" /></SelectTrigger>
                    <SelectContent>
                      {data.trees.map((tree) => <SelectItem value={tree.id} key={tree.id}>{tree.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="assistant-member">Act as a profile <span className="font-normal text-muted-foreground">(optional)</span></Label>
                  <Select value={memberId || "none"} onValueChange={(value) => setMemberId(value === "none" ? "" : value)} disabled={!treeId}>
                    <SelectTrigger id="assistant-member" data-testid="select-assistant-member"><SelectValue placeholder="No profile selected" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No profile selected</SelectItem>
                      {availableMembers.map((member) => <SelectItem value={member.id} key={member.id}>{member.name}{member.claimedByMe ? " · yours" : ""}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">The of:member anchor requires a profile selection.</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Button type="submit" disabled={createPending || !name.trim() || !treeId} data-testid="button-create-assistant-key">
                  {createPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                  {createPending ? "Creating access…" : "Create assistant access"}
                </Button>
                <span className="text-xs text-muted-foreground">Read access is implicit; checked permissions are writes.</span>
              </div>
            </div>
            <fieldset className="space-y-3 rounded-xl border bg-muted/25 p-4">
              <legend className="px-1 text-sm font-semibold">Explicit consent</legend>
              <p className="text-xs leading-relaxed text-muted-foreground">Each checked permission is granted to this key. You can revoke it at any time.</p>
              {ASSISTANT_SCOPES.map((scope) => (
                <label key={scope} className="flex cursor-pointer items-start gap-3 text-sm">
                  <Checkbox checked={scopes.includes(scope)} onCheckedChange={(checked) => toggleScope(scope, checked === true)} aria-label={SCOPE_LABELS[scope]} />
                  <span className="leading-5">{SCOPE_LABELS[scope]}</span>
                </label>
              ))}
            </fieldset>
          </form>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg">Your access keys</CardTitle>
          <CardDescription>Review the permissions and activity for each key. Revocation takes effect immediately.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.keys.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-muted/20 px-5 py-8 text-center">
              <KeyRound className="mx-auto h-6 w-6 text-muted-foreground" />
              <p className="mt-3 font-medium">No assistant keys yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Create a narrowly scoped key when you’re ready to connect your own AI tool.</p>
            </div>
          ) : data.keys.map((key) => (
            <KeyCard key={key.id} item={key} reviewPending={reviewKey.isPending} revokePending={revokeKey.isPending}
              onReview={(decision) => reviewKey.mutate({ id: key.id, decision })}
              onRevoke={() => {
                if (window.confirm(`Revoke “${key.name}”? This key will stop working immediately.`)) revokeKey.mutate(key.id);
              }} />
          ))}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg">Tasks needing your decision</CardTitle>
          <CardDescription>Some changes stay in draft until you approve them here. Review the proposed details before confirming.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {pendingActions.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-muted/20 px-5 py-7 text-center">
              <Check className="mx-auto h-5 w-5 text-muted-foreground" />
              <p className="mt-2 text-sm font-medium">Nothing is waiting for approval</p>
            </div>
          ) : pendingActions.map((action) => {
            const candidates = candidatesFrom(action);
            const ambiguous = isAmbiguous(action, candidates);
            const result = resultRecord(action);
            const mergeAction = action.action === "people:merge" || action.action === "merge" || !!result.candidateGroups;
            const draftPerson = action.action === "people:add" && action.status === "draft";
            const selectionField = String(result.selectionField ?? "");
            const needsAnchor = !draftPerson && (selectionField === "of" || (action.action === "people:add" && action.status === "pending_confirmation"));
            const needsPerson = !draftPerson && selectionField === "memberId";
            const needsBulkWarning = action.action === "delete_all" || action.action === "email_all";
            const emailMismatch = action.action === "email:send" && result.recipient != null && result.message != null;
            const treeMembers = data.trees.find((tree) => tree.id === action.treeId)?.members ?? [];
            const anchorOptions = treeMembers.filter((member) => member.claimedByMe).map((member) => ({ id: member.id, name: member.name }));
            const recipientOptions = candidates;
            const keepOptions = mergeCandidates(action, "keepMemberId");
            const mergeOptions = mergeCandidates(action, "mergeMemberId");
            const isOpen = openApproval === action.id;
            return (
              <div key={action.id} className="rounded-xl border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{pretty(action.action)}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs ${draftPerson ? "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200" : "bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-100"}`}>{pretty(action.status)}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{dateLabel(action.createdAt)} · Tree {data.trees.find((tree) => tree.id === action.treeId)?.name ?? action.treeId}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={decideAction.isPending} data-testid={`button-reject-assistant-action-${action.id}`} onClick={() => decideAction.mutate({ action, decision: "reject", body: {} })}>
                      <X className="mr-1.5 h-4 w-4" /> Reject
                    </Button>
                    <Button size="sm" disabled={decideAction.isPending} data-testid={`button-approve-assistant-action-${action.id}`} onClick={() => {
                      if (draftPerson && !ambiguous) approve(action);
                      else setOpenApproval(isOpen ? null : action.id);
                    }}>
                      Review & approve
                    </Button>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <DetailBlock title="Proposed task" value={action.payload} />
                  {action.result && <DetailBlock title="Assistant explanation" value={action.result} />}
                </div>
                {isOpen && (
                  <div className="mt-4 space-y-4 border-t pt-4">
                    {mergeAction && ambiguous && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor={`keep-${action.id}`}>Keep this profile</Label>
                          <MemberSelect id={`keep-${action.id}`} value={keepMember[action.id] ?? (keepOptions.length === 1 ? keepOptions[0].id : "")} onChange={(value) => setKeepMember({ ...keepMember, [action.id]: value })} options={keepOptions} disabled={keepOptions.length <= 1} />
                          {keepOptions.length === 1 && <p className="text-xs text-muted-foreground">Fixed candidate: {keepOptions[0].name}</p>}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`merge-${action.id}`}>Merge this duplicate into it</Label>
                          <MemberSelect id={`merge-${action.id}`} value={mergeMember[action.id] ?? (mergeOptions.length === 1 ? mergeOptions[0].id : "")} onChange={(value) => setMergeMember({ ...mergeMember, [action.id]: value })} options={mergeOptions} disabled={mergeOptions.length <= 1} />
                          {mergeOptions.length === 1 && <p className="text-xs text-muted-foreground">Fixed candidate: {mergeOptions[0].name}</p>}
                        </div>
                      </div>
                    )}
                    {needsAnchor && !mergeAction && (
                      <div className="max-w-md space-y-2">
                        <Label htmlFor={`anchor-${action.id}`}>Choose a family profile you claimed as the anchor</Label>
                        <MemberSelect id={`anchor-${action.id}`} value={selection[action.id] ?? ""} onChange={(value) => setSelection({ ...selection, [action.id]: value })} options={anchorOptions} />
                        {action.status === "pending_confirmation" && <p className="text-xs text-muted-foreground">This approval creates a hidden draft. You must accept that draft separately before it becomes a member.</p>}
                        {anchorOptions.length === 0 && <p className="text-xs text-destructive">No profiles claimed by you are available in this tree.</p>}
                      </div>
                    )}
                    {needsPerson && !mergeAction && (
                      <div className="max-w-md space-y-2">
                        <Label htmlFor={`person-${action.id}`}>Choose the exact person or recipient</Label>
                        <MemberSelect id={`person-${action.id}`} value={selection[action.id] ?? ""} onChange={(value) => setSelection({ ...selection, [action.id]: value })} options={recipientOptions} />
                      </div>
                    )}
                    {emailMismatch && (
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Email recipient differs from the address on record</AlertTitle>
                        <AlertDescription className="space-y-3">
                          <p>{String(result.message)}</p>
                          <p className="font-semibold">Proposed recipient: {typeof result.recipient === "string" ? result.recipient : describeRecord(result.recipient)}</p>
                          <label className="flex items-start gap-2 font-medium">
                            <Checkbox checked={!!acknowledged[`${action.id}:email`]} onCheckedChange={(checked) => setAcknowledged({ ...acknowledged, [`${action.id}:email`]: checked === true })} />
                            <span>I verified this exact email recipient and explicitly approve sending to them.</span>
                          </label>
                        </AlertDescription>
                      </Alert>
                    )}
                    {needsBulkWarning && (
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>{action.action === "delete_all" ? "Review the exact people affected by this deletion" : "Review the exact recipients of this bulk email"}</AlertTitle>
                        <AlertDescription className="space-y-3">
                          {result.warning != null && <p className="font-semibold">{typeof result.warning === "string" ? result.warning : describeRecord(result.warning)}</p>}
                          <p>{Array.isArray(result.people) ? `${result.people.length} ${result.people.length === 1 ? "person" : "people"} in the proposed snapshot:` : "The backend did not provide a recipient snapshot."}</p>
                          {Array.isArray(result.people) && (
                            <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-destructive/20 bg-background/60 p-3">
                              {result.people.map((person: unknown, index: number) => {
                                if (typeof person === "string") return <li key={`${person}-${index}`} className="text-sm">{person}</li>;
                                const row = person && typeof person === "object" ? person as Record<string, unknown> : {};
                                const personName = row.name ?? row.fullName ?? "Unnamed person";
                                const email = row.email;
                                return <li key={`${String(row.id ?? email ?? personName)}-${index}`} className="text-sm">{String(personName)}{email ? <span className="ml-2 text-muted-foreground">&lt;{String(email)}&gt;</span> : null}</li>;
                              })}
                            </ul>
                          )}
                          <p>Confirm the exact snapshot above. This action may have a significant effect and may not be reversible.</p>
                          <label className="flex items-start gap-2 font-medium">
                            <Checkbox checked={!!acknowledged[`${action.id}:bulk`]} onCheckedChange={(checked) => setAcknowledged({ ...acknowledged, [`${action.id}:bulk`]: checked === true })} />
                            <span>I have reviewed this exact list and explicitly approve this task.</span>
                          </label>
                        </AlertDescription>
                      </Alert>
                    )}
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button variant="ghost" onClick={() => setOpenApproval(null)}>Cancel</Button>
                      <Button disabled={decideAction.isPending} data-testid={`button-approve-confirm-assistant-action-${action.id}`} onClick={() => approve(action)}>
                        {decideAction.isPending ? "Approving…" : "Confirm approval"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg">Recent activity</CardTitle>
          <CardDescription>Audit history for assistant tasks. Secret keys are never included.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {historyActions.length === 0 ? (
            <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">Completed and rejected tasks will appear here.</p>
          ) : historyActions.map((action) => (
            <details key={action.id} className="group rounded-xl border px-4 py-3">
              <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{pretty(action.action)}</span>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">{pretty(action.status)} · {dateLabel(action.createdAt)}</span>
              </summary>
              <div className="mt-3 grid gap-3 border-t pt-3 md:grid-cols-2">
                <DetailBlock title="Task details" value={action.payload} />
                {action.result && <DetailBlock title="Result" value={action.result} />}
              </div>
            </details>
          ))}
        </CardContent>
      </Card>

      <SetupGuide />
    </section>
  );
}

function KeyCard({ item, onReview, onRevoke, reviewPending, revokePending }: {
  item: AssistantKeyView;
  onReview: (decision: "renew" | "extend" | "stop") => void;
  onRevoke: () => void;
  reviewPending: boolean;
  revokePending: boolean;
}) {
  const stateStyle: Record<string, string> = {
    active: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
    review_due: "bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-100",
    paused: "bg-orange-100 text-orange-950 dark:bg-orange-950 dark:text-orange-100",
    revoked: "bg-muted text-muted-foreground",
  };
  return (
    <article className="rounded-xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{item.name}</h3><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${stateStyle[item.state] ?? stateStyle.revoked}`}>{pretty(item.state)}</span></div>
          <p className="mt-1 text-sm text-muted-foreground">{item.treeName}{item.memberId ? " · Profile-specific access" : " · Tree access"}</p>
        </div>
        {item.state !== "revoked" && <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={onRevoke} disabled={revokePending} data-testid={`button-revoke-assistant-key-${item.id}`}>Revoke</Button>}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {item.scopes.map((scope) => <span key={scope} className="rounded-md bg-muted px-2 py-1 text-xs">{SCOPE_LABELS[scope]}</span>)}
        {item.scopes.length === 0 && <span className="text-xs text-muted-foreground">Read-only access</span>}
      </div>
      <div className="mt-3 grid gap-x-5 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
        <span>Review date: {dateLabel(item.reviewDueAt)}</span>
        <span>Last used: {dateLabel(item.lastUsedAt)}</span>
      </div>
      {item.state !== "revoked" && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3" aria-label={`Review controls for ${item.name}`}>
          <span className="mr-auto text-sm font-medium">{item.state === "paused" ? "Write access is paused." : item.state === "review_due" ? "Review this key’s access." : "Manage write access."}</span>
          <Button size="sm" onClick={() => onReview("renew")} disabled={reviewPending} data-testid={`button-review-renew-${item.id}`}>Renew 30 days</Button>
          <Button size="sm" variant="outline" onClick={() => onReview("extend")} disabled={reviewPending} data-testid={`button-review-extend-${item.id}`}>Extend 7 days</Button>
          {item.state !== "paused" && <Button size="sm" variant="ghost" onClick={() => onReview("stop")} disabled={reviewPending} data-testid={`button-review-stop-${item.id}`}>Pause writes</Button>}
        </div>
      )}
    </article>
  );
}

function MemberSelect({ id, value, onChange, options, disabled = false }: { id: string; value: string; onChange: (value: string) => void; options: Candidate[]; disabled?: boolean }) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger id={id}><SelectValue placeholder="Choose a person" /></SelectTrigger>
      <SelectContent>{options.map((option) => <SelectItem key={option.id} value={option.id}>{option.name}</SelectItem>)}</SelectContent>
    </Select>
  );
}

function DetailBlock({ title, value }: { title: string; value: unknown }) {
  return (
    <div className="min-w-0">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted/60 p-3 font-mono text-xs leading-relaxed">{describeRecord(value)}</pre>
    </div>
  );
}

function SetupGuide() {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const example = `${origin}/api/agent/tree`;
  const lines = [
    `GET ${example}`,
    `Authorization: Bearer YOUR_KEY`,
    `Idempotency-Key: unique-task-id`,
    "",
    `POST ${origin}/api/agent/people`,
    `{"name":"Avery Chen","label":"cousin","of":"member-id"}`,
    "",
    `POST ${origin}/api/agent/labels`,
    `{"memberId":"member-id","label":"cousin","of":"member-id"}`,
    "",
    `POST ${origin}/api/agent/invite`,
    `{"name":"Avery Chen","email":"avery@example.com"}`,
    "",
    `POST ${origin}/api/agent/email`,
    `{"memberId":"member-id","subject":"Family update","text":"A note for you."}`,
    "",
    `POST ${origin}/api/agent/merge`,
    `{"keepMemberId":"member-a","mergeMemberId":"member-b"}`,
    "",
    `POST ${origin}/api/agent/actions`,
    `{"action":"delete_all"}`,
    `{"action":"email_all","subject":"News","text":"Family update"}`,
  ].join("\n");
  const endpoints = [
    ["GET", "/tree", "Read the selected tree"],
    ["POST", "/people", "Draft a person: { name, label, of }"],
    ["POST", "/labels", "Set a label: { memberId, label, of }"],
    ["POST", "/invite", "Send an invite: { name, email }"],
    ["POST", "/email", "Email a member: { memberId, subject, text }"],
    ["POST", "/merge", "Merge profiles: { keepMemberId, mergeMemberId }"],
    ["POST", "/actions", "Request delete_all or email_all"],
  ];
  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="text-lg">Connect your own AI tool</CardTitle>
        <CardDescription>Use these relative API examples with a client that supports authenticated HTTP tools. Compatibility differs by client.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm">
          <a href="/faq" className="font-medium text-primary underline underline-offset-2">Read the Assistant setup FAQ</a>
          {" "}for step-by-step private ChatGPT Actions setup, other-client compatibility, permissions, and troubleshooting.
        </p>
        <Alert>
          <LockKeyhole className="h-4 w-4" />
          <AlertTitle>Keep credentials and task retries safe</AlertTitle>
          <AlertDescription>Use a unique requestId in the JSON body, or an Idempotency-Key header, for every write task. Reuse it only for identical retries. GPT Actions should use the JSON field. Keep a personal API-key GPT private—never share it. Replace YOUR_KEY only in your secure credential store; never use a real key in a prompt or shared document.</AlertDescription>
        </Alert>
        <div className="grid gap-4 lg:grid-cols-[.8fr_1.2fr]">
          <div>
            <h3 className="mb-2 text-sm font-semibold">Supported endpoints</h3>
            <ul className="space-y-2">
              {endpoints.map(([method, path, description]) => (
                <li key={path} className="flex gap-2 text-sm"><code className="w-11 shrink-0 text-xs font-semibold text-primary">{method}</code><span><code className="text-xs">{path}</code><span className="mt-0.5 block text-xs text-muted-foreground">{description}</span></span></li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-muted-foreground">Public reference: <a className="underline underline-offset-2" href={`${origin}/api/agent/openapi.json`} target="_blank" rel="noreferrer">API documentation</a> · <a className="underline underline-offset-2" href={`${origin}/api/agent/health`} target="_blank" rel="noreferrer">Service health</a></p>
          </div>
          <div>
            <Label htmlFor="assistant-example">Example request setup</Label>
            <Textarea id="assistant-example" readOnly value={lines} rows={19} className="mt-2 resize-y font-mono text-xs leading-relaxed" />
            <p className="mt-2 text-xs text-muted-foreground">Write requests use the same Bearer key and a fresh Idempotency-Key. People are drafted for on-site review; approvals, recipients, and sensitive actions stay under your control.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
