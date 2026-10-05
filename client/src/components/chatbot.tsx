import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import type { HelpActionResult, HelpConfirmation } from "@shared/help-assistant";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertCircle,
  Bot,
  Check,
  Clock3,
  Loader2,
  MessageCircle,
  Send,
  User,
  X,
} from "lucide-react";

type ConfirmationState = {
  confirmation: HelpConfirmation;
  status: "pending" | "working" | "resolved" | "failed" | "expired";
  result?: string;
  error?: string;
  canRetry?: boolean;
};

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  error?: string;
  confirmation?: ConfirmationState;
}

type StreamFrame =
  | { content: string }
  | { confirmation: HelpConfirmation }
  | { error: string }
  | { done: true; fullContent: string };

const greeting = (signedIn: boolean) =>
  signedIn
    ? "Hi! I’m your FamilyRoots assistant. I can read the trees and circles you own, help you find things, and guide you through FamilyRoots. Before I create, change, invite, or delete anything, I’ll show you exactly what I’m about to do and ask you to confirm.\n\nFor a shareable QR code, visit the Share page (/share). What can I help with?"
    : "Hi! I’m your FamilyRoots assistant. I can answer public how-to questions about using FamilyRoots and genealogy. Sign in when you want help with the trees and circles you own.\n\nFor a shareable QR code, visit the Share page (/share). What can I help with?";

const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

function actionQuestion(summary: string) {
  const clean = summary.trim();
  if (clean.endsWith("?")) return clean;
  if (/^(create|add|send|delete|remove|make|invite)\b/i.test(clean)) {
    return `Should I ${clean.charAt(0).toLowerCase()}${clean.slice(1)}?`;
  }
  return `Should I proceed with this action? ${clean}`;
}

function responseMessage(body: unknown, fallback: string) {
  if (body && typeof body === "object") {
    const value = body as Record<string, unknown>;
    if (typeof value.message === "string" && value.message.trim()) return value.message;
    if (typeof value.error === "string" && value.error.trim()) return value.error;
  }
  return fallback;
}

function parseSseBlock(block: string): StreamFrame | null {
  const data = block
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).replace(/^ /, ""))
    .join("\n");
  if (!data.trim()) return null;
  try {
    const parsed = JSON.parse(data) as Record<string, unknown>;
    if (typeof parsed.content === "string") return { content: parsed.content };
    if (parsed.confirmation && typeof parsed.confirmation === "object") {
      return { confirmation: parsed.confirmation as HelpConfirmation };
    }
    if (typeof parsed.error === "string") return { error: parsed.error };
    if (parsed.done === true && typeof parsed.fullContent === "string") {
      return { done: true, fullContent: parsed.fullContent };
    }
    return { error: "The assistant sent an unreadable response. Please try again." };
  } catch {
    return { error: "The assistant sent an unreadable response. Please try again." };
  }
}

function isExpired(confirmation: HelpConfirmation) {
  const expiry = Date.parse(confirmation.expiresAt);
  return Number.isFinite(expiry) && expiry <= Date.now();
}

export function Chatbot() {
  const [pathname] = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  // Leave the tree's bottom-right Connection Requests controls accessible.
  const bottomOffset = pathname.startsWith("/tree/") ? "5rem" : "1rem";
  const floatingBottom = `max(${bottomOffset}, env(safe-area-inset-bottom))`;
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sequenceRef = useRef(0);
  const accountRef = useRef<string | null>(null);
  const accountEpochRef = useRef(0);
  const activeRequestRef = useRef<AbortController | null>(null);
  const hasInitializedRef = useRef(false);
  const signedIn = !!user;

  useEffect(() => {
    const nextAccount = user?.id == null ? null : String(user.id);
    if (hasInitializedRef.current && accountRef.current === nextAccount) return;
    hasInitializedRef.current = true;
    accountRef.current = nextAccount;
    accountEpochRef.current += 1;
    activeRequestRef.current?.abort();
    activeRequestRef.current = null;
    setMessages([{ id: "welcome", role: "assistant", content: greeting(!!nextAccount) }]);
    setInput("");
    setIsLoading(false);
  }, [user?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const updateMessage = (id: string, update: (message: ChatMessage) => ChatMessage) => {
    setMessages((current) => current.map((message) => (message.id === id ? update(message) : message)));
  };

  const invalidateFamilyData = async () => {
    const relevant = ["/api/trees", "/api/events", "/api/invitations", "/api/dashboard", "/api/agent/settings"];
    await Promise.all(
      relevant.map((path) =>
        queryClient.invalidateQueries({
          predicate: (query) => {
            const key = JSON.stringify(query.queryKey).toLowerCase();
            return key.includes(path);
          },
        }),
      ),
    );
  };

  const runAction = async (messageId: string, confirmation: HelpConfirmation, decision: "confirm" | "cancel") => {
    const alreadyExpired = isExpired(confirmation);
    if (alreadyExpired) {
      updateMessage(messageId, (message) => ({
        ...message,
        confirmation: {
          confirmation,
          status: "expired",
          error: "This confirmation has expired. Ask the assistant to prepare the action again.",
        },
      }));
      return;
    }

    updateMessage(messageId, (message) => ({
      ...message,
      confirmation: { confirmation, status: "working" },
    }));

    try {
      const response = await fetch(
        `/api/chat/actions/${encodeURIComponent(confirmation.actionId)}/${decision}`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(decision === "confirm" ? { confirmed: true } : {}),
        },
      );
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        const bodyError = responseMessage(body, "").toLowerCase();
        const expired =
          response.status === 410 ||
          response.status === 404 ||
          bodyError.includes("expired") ||
          bodyError.includes("no longer available");
        const transient = response.status === 408 || response.status === 425 || response.status === 429 || response.status >= 500;
        const errorText = responseMessage(
          body,
          expired
            ? "This confirmation has expired or is no longer available. Ask the assistant to prepare the action again."
            : `The action could not be completed (${response.status}).`,
        );
        const uncertainInvite =
          decision === "confirm" &&
          confirmation.kind === "send_invite" &&
          response.status >= 500;
        updateMessage(messageId, (message) => ({
          ...message,
          confirmation: {
            confirmation,
            status: expired ? "expired" : "failed",
            error: uncertainInvite
              ? `${errorText} The invitation result is uncertain, so it can’t safely be retried here. Check your invitations before asking again.`
              : errorText,
            canRetry: !expired && transient && !uncertainInvite,
          },
        }));
        return;
      }

      const result = body as HelpActionResult | null;
      const message = typeof result?.message === "string" ? result.message : "The action was completed.";
      updateMessage(messageId, (current) => ({
        ...current,
        confirmation: { confirmation, status: "resolved", result: message },
      }));
      if (decision === "confirm") void invalidateFamilyData();
    } catch (error) {
      const uncertainInvite = decision === "confirm" && confirmation.kind === "send_invite";
      updateMessage(messageId, (message) => ({
        ...message,
        confirmation: {
          confirmation,
          status: "failed",
          error: uncertainInvite
            ? "We couldn’t verify whether the invitation was sent. Check your invitations before asking again; this action can’t be retried safely."
            : error instanceof Error && error.name === "AbortError"
              ? "The request was interrupted. You can try again."
              : "A temporary connection problem prevented the action. You can try again.",
          canRetry: !uncertainInvite,
        },
      }));
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    const assistantId = makeId();
    const epoch = accountEpochRef.current;
    const history = messages
      .slice(-10)
      .map(({ role, content, confirmation }) => ({
        role,
        content: content + (confirmation?.status === "resolved" && confirmation.result ? `\nTask result: ${confirmation.result}` : ""),
      }));
    const controller = new AbortController();
    activeRequestRef.current = controller;
    setInput("");
    setMessages((previous) => [
      ...previous,
      { id: makeId(), role: "user", content: userMessage },
      { id: assistantId, role: "assistant", content: "" },
    ]);
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage, history }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        if (response.status === 403 && (errorData as { error?: string } | null)?.error === "tier_limit_reached") {
          const limit = (errorData as { limit?: number }).limit;
          const nextTier = (errorData as { nextTier?: string }).nextTier;
          const nextLabel = nextTier
            ? ({ cultivator: "Cultivator", heritage: "Heritage", legacy: "Legacy" }[nextTier] || "a higher plan")
            : "a higher plan";
          const notice = `You've used all ${limit ?? "available"} AI chat messages for this month on your current plan. Upgrade to ${nextLabel} for more messages.\n\n[View Plans](/pricing)`;
          if (epoch === accountEpochRef.current) {
            updateMessage(assistantId, (message) => ({ ...message, content: notice }));
          }
          return;
        }
        throw new Error(responseMessage(errorData, `The assistant could not respond (${response.status}).`));
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("The assistant response stream was unavailable.");
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantContent = "";
      let streamError: string | undefined;
      const consume = (block: string) => {
        const frame = parseSseBlock(block);
        if (!frame || epoch !== accountEpochRef.current) return;
        if ("content" in frame) {
          assistantContent += frame.content;
          updateMessage(assistantId, (message) => ({ ...message, content: assistantContent }));
        } else if ("confirmation" in frame) {
          updateMessage(assistantId, (message) => ({
            ...message,
            confirmation: {
              confirmation: frame.confirmation,
              status: isExpired(frame.confirmation) ? "expired" : "pending",
              error: isExpired(frame.confirmation)
                ? "This confirmation has expired. Ask the assistant to prepare the action again."
                : undefined,
            },
          }));
        } else if ("error" in frame) {
          streamError = frame.error;
          updateMessage(assistantId, (message) => ({ ...message, error: frame.error }));
        } else {
          assistantContent = frame.fullContent;
          updateMessage(assistantId, (message) => ({ ...message, content: frame.fullContent }));
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let boundary = buffer.match(/\r?\n\r?\n/);
        while (boundary && boundary.index !== undefined) {
          const block = buffer.slice(0, boundary.index);
          buffer = buffer.slice(boundary.index + boundary[0].length);
          consume(block);
          boundary = buffer.match(/\r?\n\r?\n/);
        }
      }
      buffer += decoder.decode();
      if (buffer.trim()) consume(buffer);
      if (streamError && epoch === accountEpochRef.current) {
        updateMessage(assistantId, (message) => ({ ...message, error: streamError }));
      }
    } catch (error) {
      if (epoch === accountEpochRef.current && !(error instanceof Error && error.name === "AbortError")) {
        updateMessage(assistantId, (message) => ({
          ...message,
          error: error instanceof Error ? error.message : "A connection error interrupted the response. Please try again.",
        }));
      }
    } finally {
      if (epoch === accountEpochRef.current) {
        setIsLoading(false);
        activeRequestRef.current = null;
      }
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  };

  return (
    <>
      {!isOpen && (
        <Button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-4 right-4 z-50 max-w-[calc(100vw_-_2rem)] rounded-full shadow-lg"
          style={{ position: "fixed", zIndex: 50, bottom: floatingBottom, right: "max(1rem, env(safe-area-inset-right))" }}
          size="lg"
          data-testid="button-open-chatbot"
        >
          <MessageCircle className="mr-2 h-5 w-5" />
          Help
        </Button>
      )}

      {isOpen && (
        <Card
          className="fixed bottom-4 right-4 z-50 flex h-[500px] max-h-[calc(100dvh_-_2rem)] w-[380px] max-w-[calc(100vw_-_2rem)] flex-col shadow-xl"
          style={{
            position: "fixed",
            zIndex: 50,
            bottom: floatingBottom,
            right: "max(1rem, env(safe-area-inset-right))",
            maxHeight: `calc(100dvh - ${bottomOffset} - env(safe-area-inset-bottom) - env(safe-area-inset-top) - 1rem)`,
            width: "min(380px, calc(100vw - env(safe-area-inset-right) - env(safe-area-inset-left) - 2rem))",
          }}
          data-testid="chatbot-container"
        >
          <CardHeader className="flex flex-row items-center justify-between gap-2 border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base font-medium">FamilyRoots Assistant</CardTitle>
                <p className="text-[11px] text-muted-foreground">{signedIn ? "Your private family network" : "Public how-to help"}</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} data-testid="button-close-chatbot">
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>

          <CardContent className="flex flex-1 flex-col overflow-hidden p-0">
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.map((msg, index) => (
                  <div key={msg.id} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    {msg.role === "assistant" && (
                      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <Bot className="h-3.5 w-3.5 text-primary" />
                      </div>
                    )}
                    <div className="max-w-[88%] min-w-0 space-y-2">
                      <div
                        className={`whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-sm ${
                          msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                        }`}
                        data-testid={`message-${msg.role}-${index}`}
                      >
                        {msg.content || (isLoading && msg.id === messages[messages.length - 1]?.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-label="Loading response" />
                        ) : null)}
                      </div>
                      {msg.error && (
                        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive" role="alert">
                          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                          <span>{msg.error}</span>
                        </div>
                      )}
                      {msg.confirmation && (
                        <div className="rounded-lg border border-primary/25 bg-background p-3 shadow-sm" data-testid={`help-confirmation-${msg.confirmation.confirmation.actionId}`}>
                          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-foreground">
                            {msg.confirmation.status === "resolved" ? (
                              <Check className="h-4 w-4 text-primary" />
                            ) : msg.confirmation.status === "expired" || isExpired(msg.confirmation.confirmation) ? (
                              <Clock3 className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-primary" />
                            )}
                            {msg.confirmation.status === "resolved" ? "Action complete" : msg.confirmation.status === "expired" || isExpired(msg.confirmation.confirmation) ? "Confirmation expired" : "Please confirm"}
                          </div>
                          <p className="text-sm leading-relaxed">{actionQuestion(msg.confirmation.confirmation.summary)}</p>
                          {msg.confirmation.result && <p className="mt-2 text-sm text-muted-foreground">{msg.confirmation.result}</p>}
                          {(msg.confirmation.error || (isExpired(msg.confirmation.confirmation) && msg.confirmation.status === "pending")) && (
                            <p className="mt-2 text-xs text-destructive" role="alert">
                              {msg.confirmation.error || "This confirmation has expired. Ask the assistant to prepare the action again."}
                            </p>
                          )}
                          {msg.confirmation.status === "pending" && !isExpired(msg.confirmation.confirmation) && (
                            <div className="mt-3 flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => void runAction(msg.id, msg.confirmation!.confirmation, "confirm")}
                                data-testid={`button-confirm-help-action-${msg.confirmation.confirmation.actionId}`}
                              >
                                Confirm
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => void runAction(msg.id, msg.confirmation!.confirmation, "cancel")}
                                data-testid={`button-cancel-help-action-${msg.confirmation.confirmation.actionId}`}
                              >
                                Cancel
                              </Button>
                            </div>
                          )}
                          {msg.confirmation.status === "working" && (
                            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              {`Processing ${msg.confirmation.confirmation.kind.replace(/_/g, " ")}…`}
                            </div>
                          )}
                          {msg.confirmation.status === "failed" && msg.confirmation.canRetry && (
                            <div className="mt-3 flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => void runAction(msg.id, msg.confirmation!.confirmation, "confirm")}
                                data-testid={`button-confirm-help-action-${msg.confirmation.confirmation.actionId}`}
                              >
                                Try again
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => void runAction(msg.id, msg.confirmation!.confirmation, "cancel")}
                                data-testid={`button-cancel-help-action-${msg.confirmation.confirmation.actionId}`}
                              >
                                Cancel
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    {msg.role === "user" && (
                      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary">
                        <User className="h-3.5 w-3.5 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            <div className="border-t p-4">
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={signedIn ? "Ask about your family tree..." : "Ask a FamilyRoots how-to question..."}
                  disabled={isLoading}
                  className="flex-1"
                  data-testid="input-chat-message"
                />
                <Button onClick={() => void sendMessage()} disabled={!input.trim() || isLoading} size="icon" data-testid="button-send-message">
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
