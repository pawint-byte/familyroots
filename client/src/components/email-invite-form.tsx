import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Mail, X, Send, UserPlus, Loader2 } from "lucide-react";

interface EmailInviteFormProps {
  referralCode?: string;
  treeName?: string;
}

export function EmailInviteForm({ referralCode, treeName }: EmailInviteFormProps) {
  const { toast } = useToast();
  const [emails, setEmails] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState("");
  const [message, setMessage] = useState(
    treeName 
      ? `I've been building our family tree on FamilyRoots and would love for you to join! You can view and add to our family history together.`
      : `I've been using FamilyRoots to build my family tree and thought you might enjoy it too! It's a great way to preserve and share family history.`
  );

  const sendInvitesMutation = useMutation({
    mutationFn: async (data: { emails: string[]; message: string; referralCode?: string }) => {
      return apiRequest("POST", "/api/invites/email", data);
    },
    onSuccess: () => {
      toast({
        title: "Invites sent!",
        description: `Successfully sent ${emails.length} invite${emails.length > 1 ? "s" : ""}.`,
      });
      setEmails([]);
      setEmailInput("");
    },
    onError: () => {
      toast({
        title: "Failed to send",
        description: "There was an error sending the invites. Please try again.",
        variant: "destructive",
      });
    },
  });

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const addEmail = () => {
    const trimmed = emailInput.trim().toLowerCase();
    if (trimmed && isValidEmail(trimmed) && !emails.includes(trimmed)) {
      setEmails([...emails, trimmed]);
      setEmailInput("");
    } else if (trimmed && !isValidEmail(trimmed)) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
    }
  };

  const removeEmail = (email: string) => {
    setEmails(emails.filter((e) => e !== email));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addEmail();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text");
    const pastedEmails = pasted.split(/[,\s]+/).filter(isValidEmail);
    const uniqueNew = pastedEmails.filter((email) => !emails.includes(email.toLowerCase()));
    if (uniqueNew.length > 0) {
      setEmails([...emails, ...uniqueNew.map((e) => e.toLowerCase())]);
    }
  };

  const handleSubmit = () => {
    if (emails.length === 0) {
      toast({
        title: "No emails",
        description: "Please add at least one email address.",
        variant: "destructive",
      });
      return;
    }
    sendInvitesMutation.mutate({ emails, message, referralCode });
  };

  return (
    <Card data-testid="card-email-invite">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" />
          <CardTitle className="font-serif">Invite Family by Email</CardTitle>
        </div>
        <CardDescription>
          Send personalized invitations to family members
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Email Addresses</label>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="Enter email and press Enter"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              data-testid="input-invite-email"
            />
            <Button
              type="button"
              variant="outline"
              onClick={addEmail}
              data-testid="button-add-email"
            >
              <UserPlus className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Press Enter or comma to add. Paste multiple emails separated by commas.
          </p>
        </div>

        {emails.length > 0 && (
          <div className="flex flex-wrap gap-2" data-testid="list-invite-emails">
            {emails.map((email) => (
              <Badge
                key={email}
                variant="secondary"
                className="gap-1 pr-1"
              >
                {email}
                <button
                  onClick={() => removeEmail(email)}
                  className="ml-1 rounded-full p-0.5 hover:bg-muted"
                  data-testid={`button-remove-email-${email}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium">Personal Message (optional)</label>
          <Textarea
            placeholder="Add a personal note..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            data-testid="textarea-invite-message"
          />
        </div>

        <Button
          onClick={handleSubmit}
          disabled={emails.length === 0 || sendInvitesMutation.isPending}
          className="w-full"
          data-testid="button-send-invites"
        >
          {sendInvitesMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              Send {emails.length > 0 ? `${emails.length} Invite${emails.length > 1 ? "s" : ""}` : "Invites"}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
