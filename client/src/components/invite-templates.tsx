import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Copy, CheckCircle2, MessageSquare, Smartphone } from "lucide-react";

interface InviteTemplatesProps {
  referralLink: string;
  userName?: string;
}

const templates = [
  {
    id: "casual",
    label: "Casual",
    getMessage: (link: string, name?: string) =>
      `Hey! ${name ? `It's ${name}. ` : ""}I've been building our family tree online and thought you'd like to see it. Check it out here: ${link}`,
  },
  {
    id: "detailed",
    label: "Detailed",
    getMessage: (link: string, name?: string) =>
      `Hi there!\n\n${name ? `This is ${name}. ` : ""}I found this amazing app called FamilyRoots that lets you build and share family trees. I've already started adding some of our family members and would love for you to join and add more.\n\nHere's my invite link: ${link}\n\nLet me know what you think!`,
  },
  {
    id: "reunion",
    label: "Family Reunion",
    getMessage: (link: string, name?: string) =>
      `Family tree project!\n\n${name ? `${name} here. ` : ""}I'm putting together our family tree for our next reunion. Would love your help adding relatives and photos. Join here: ${link}`,
  },
  {
    id: "grandparent",
    label: "For Elders",
    getMessage: (link: string, name?: string) =>
      `Hi! ${name ? `It's ${name}. ` : ""}I'm using a website to create our family tree and preserve our family history. I'd love your help adding details about our ancestors. Can you take a look? ${link}`,
  },
];

export function InviteTemplates({ referralLink, userName }: InviteTemplatesProps) {
  const { toast } = useToast();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyTemplate = async (templateId: string, message: string) => {
    try {
      await navigator.clipboard.writeText(message);
      setCopiedId(templateId);
      toast({
        title: "Message copied!",
        description: "Paste this in your messaging app.",
      });
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast({
        title: "Failed to copy",
        description: "Please copy the message manually.",
        variant: "destructive",
      });
    }
  };

  const openSmsWithTemplate = (message: string) => {
    const encoded = encodeURIComponent(message);
    window.location.href = `sms:?body=${encoded}`;
  };

  return (
    <Card data-testid="card-invite-templates">
      <CardHeader>
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          <CardTitle className="font-serif">Ready-to-Send Messages</CardTitle>
        </div>
        <CardDescription>
          Copy these pre-written messages to text or message your family
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {templates.map((template) => {
          const message = template.getMessage(referralLink, userName);
          const isCopied = copiedId === template.id;
          
          return (
            <div
              key={template.id}
              className="p-4 rounded-lg bg-muted/50 space-y-3"
              data-testid={`template-${template.id}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{template.label}</span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openSmsWithTemplate(message)}
                    title="Open in Messages"
                    data-testid={`button-sms-${template.id}`}
                  >
                    <Smartphone className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyTemplate(template.id, message)}
                    data-testid={`button-copy-template-${template.id}`}
                  >
                    {isCopied ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {message}
              </p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
