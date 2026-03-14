import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { TierUpgradePrompt } from "@/components/tier-upgrade-prompt";
import { useAuth } from "@/hooks/use-auth";
import {
  Send, Trash2, Pencil, X, Check, Reply, MessageSquare, Lock,
} from "lucide-react";

interface WallUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
}

interface WallMessage {
  id: string;
  treeId: string;
  userId: string;
  content: string;
  replyToId: string | null;
  editedAt: string | null;
  createdAt: string;
  user: WallUser | null;
}

interface TreeWallProps {
  treeId: string;
  canEdit: boolean;
}

function getInitials(user: WallUser | null): string {
  if (!user) return "?";
  const f = user.firstName?.[0] || "";
  const l = user.lastName?.[0] || "";
  return (f + l).toUpperCase() || "?";
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

export function TreeWall({ treeId, canEdit }: TreeWallProps) {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [tierBlocked, setTierBlocked] = useState<{ tier: string; nextTier: string | null } | null>(null);

  const { data: messages, isLoading } = useQuery<WallMessage[]>({
    queryKey: ['/api/trees', treeId, 'wall'],
    queryFn: async () => {
      const res = await fetch(`/api/trees/${treeId}/wall`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch messages');
      return res.json();
    },
    refetchInterval: 15000,
  });

  const postMutation = useMutation({
    mutationFn: async (data: { content: string; replyToId?: string | null }) => {
      const res = await apiRequest("POST", `/api/trees/${treeId}/wall`, data);
      return res.json();
    },
    onSuccess: () => {
      setMessage("");
      setReplyToId(null);
      setTierBlocked(null);
      queryClient.invalidateQueries({ queryKey: ['/api/trees', treeId, 'wall'] });
    },
    onError: (error: any) => {
      try {
        const parsed = JSON.parse(error.message.replace(/^\d+:\s*/, ''));
        if (parsed.error === 'tier_limit_reached') {
          setTierBlocked({ tier: parsed.tier, nextTier: parsed.nextTier });
          return;
        }
      } catch {}
      toast({ title: "Failed to send", description: "Could not post your message.", variant: "destructive" });
    },
  });

  const editMutation = useMutation({
    mutationFn: async ({ messageId, content }: { messageId: string; content: string }) => {
      await apiRequest("PATCH", `/api/trees/${treeId}/wall/${messageId}`, { content });
    },
    onSuccess: () => {
      setEditingId(null);
      setEditContent("");
      queryClient.invalidateQueries({ queryKey: ['/api/trees', treeId, 'wall'] });
    },
    onError: () => {
      toast({ title: "Failed to edit", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (messageId: string) => {
      await apiRequest("DELETE", `/api/trees/${treeId}/wall/${messageId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trees', treeId, 'wall'] });
    },
    onError: () => {
      toast({ title: "Failed to delete", variant: "destructive" });
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSend() {
    const text = message.trim();
    if (!text) return;
    postMutation.mutate({ content: text, replyToId });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const replyToMessage = replyToId ? messages?.find(m => m.id === replyToId) : null;

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-9 w-9 rounded-full shrink-0" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-12 w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {(!messages || messages.length === 0) && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-16">
            <MessageSquare className="h-12 w-12 mb-4 opacity-40" />
            <p className="text-lg font-medium">No messages yet</p>
            <p className="text-sm">Start the conversation!</p>
          </div>
        )}

        {messages?.map((msg, idx) => {
          const isOwn = msg.userId === currentUser?.id;
          const prevMsg = idx > 0 ? messages[idx - 1] : null;
          const sameUserAsPrev = prevMsg?.userId === msg.userId;
          const repliedMsg = msg.replyToId ? messages.find(m => m.id === msg.replyToId) : null;

          return (
            <div
              key={msg.id}
              className={`group flex gap-3 ${sameUserAsPrev ? "pt-0.5" : "pt-3"} ${isOwn ? "flex-row-reverse" : ""}`}
              data-testid={`wall-message-${msg.id}`}
            >
              {!sameUserAsPrev ? (
                <Avatar className="h-8 w-8 shrink-0 mt-1">
                  <AvatarImage src={msg.user?.profileImageUrl || undefined} />
                  <AvatarFallback className="text-xs">{getInitials(msg.user)}</AvatarFallback>
                </Avatar>
              ) : (
                <div className="w-8 shrink-0" />
              )}

              <div className={`max-w-[75%] min-w-[120px] ${isOwn ? "items-end" : "items-start"} flex flex-col`}>
                {!sameUserAsPrev && (
                  <div className={`flex items-center gap-2 mb-0.5 ${isOwn ? "flex-row-reverse" : ""}`}>
                    <span className="text-xs font-medium text-foreground">
                      {msg.user?.firstName || "Unknown"} {msg.user?.lastName || ""}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{formatTime(msg.createdAt)}</span>
                  </div>
                )}

                {repliedMsg && (
                  <div className={`text-xs text-muted-foreground border-l-2 border-primary/40 pl-2 mb-1 truncate max-w-full ${isOwn ? "text-right" : ""}`}>
                    <span className="font-medium">{repliedMsg.user?.firstName || "Unknown"}: </span>
                    {repliedMsg.content.slice(0, 80)}
                  </div>
                )}

                {editingId === msg.id ? (
                  <div className="space-y-2 w-full">
                    <Textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="min-h-[60px] text-sm"
                      data-testid="input-edit-message"
                    />
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} data-testid="button-cancel-edit">
                        <X className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => editMutation.mutate({ messageId: msg.id, content: editContent })}
                        disabled={!editContent.trim() || editMutation.isPending}
                        data-testid="button-confirm-edit"
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                      isOwn
                        ? "bg-primary text-primary-foreground rounded-tr-sm"
                        : "bg-muted rounded-tl-sm"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                    {msg.editedAt && (
                      <span className={`text-[10px] ${isOwn ? "text-primary-foreground/60" : "text-muted-foreground"}`}> (edited)</span>
                    )}
                  </div>
                )}

                <div className={`flex gap-0.5 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity ${isOwn ? "flex-row-reverse" : ""}`}>
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => setReplyToId(msg.id)}
                      data-testid={`button-reply-${msg.id}`}
                    >
                      <Reply className="h-3 w-3" />
                    </Button>
                  )}
                  {isOwn && editingId !== msg.id && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => { setEditingId(msg.id); setEditContent(msg.content); }}
                        data-testid={`button-edit-${msg.id}`}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-destructive"
                        onClick={() => deleteMutation.mutate(msg.id)}
                        data-testid={`button-delete-${msg.id}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {tierBlocked && (
        <div className="px-4 pb-2">
          <TierUpgradePrompt
            feature="Group Wall"
            used={0}
            limit={0}
            currentTier={tierBlocked.tier}
            nextTier={tierBlocked.nextTier}
            message="The Group Wall is available on Cultivator plans and above."
            compact
          />
        </div>
      )}

      {canEdit && (
        <div className="border-t border-border p-4 bg-background">
          {replyToMessage && (
            <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground bg-muted rounded-lg px-3 py-1.5">
              <Reply className="h-3 w-3 shrink-0" />
              <span className="truncate flex-1">
                Replying to <span className="font-medium">{replyToMessage.user?.firstName || "Unknown"}</span>: {replyToMessage.content.slice(0, 60)}
              </span>
              <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => setReplyToId(null)} data-testid="button-cancel-reply">
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
          <div className="flex gap-2 items-end">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Write a message..."
              className="min-h-[40px] max-h-[120px] resize-none text-sm"
              rows={1}
              data-testid="input-wall-message"
            />
            <Button
              size="sm"
              className="shrink-0 h-10 w-10 p-0"
              onClick={handleSend}
              disabled={!message.trim() || postMutation.isPending}
              data-testid="button-send-message"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">Press Enter to send, Shift+Enter for new line</p>
        </div>
      )}

      {!canEdit && (
        <div className="border-t border-border p-4 bg-muted/50">
          <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center">
            <Lock className="h-4 w-4" />
            <span>You need editor access to post messages</span>
          </div>
        </div>
      )}
    </div>
  );
}
