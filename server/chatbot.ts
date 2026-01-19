import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const SYSTEM_PROMPT = `You are a helpful genealogy assistant for FamilyRoots, a family tree management application. You help users with:

1. **Using the App**: Explain how to create trees, add family members, define relationships, and use features
2. **Genealogy Tips**: Share best practices for researching family history, documenting ancestors, and organizing information
3. **Relationship Help**: Explain family relationships (second cousins, great-grandparents, etc.)
4. **Getting Started**: Help new users understand how to begin their family tree journey

Keep responses concise, friendly, and focused on genealogy and the app. If asked about something unrelated to family history or the app, politely redirect the conversation.

Key app features to mention when relevant:
- Interactive family tree visualization with zoom/pan
- Rich member profiles with photos, dates, locations, and notes
- Timeline view of family events
- Collaboration with family members
- Privacy controls (public/private trees)
- Free tier: 1 tree, 20 members
- Premium tier ($9.99/month): Unlimited trees and members`;

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export async function getChatResponse(
  userMessage: string,
  conversationHistory: ChatMessage[] = []
): Promise<string> {
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...conversationHistory.slice(-10), // Keep last 10 messages for context
    { role: "user", content: userMessage },
  ];

  const response = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages,
    max_completion_tokens: 500,
  });

  return response.choices[0]?.message?.content || "I'm sorry, I couldn't process that request.";
}

export async function* streamChatResponse(
  userMessage: string,
  conversationHistory: ChatMessage[] = []
): AsyncGenerator<string> {
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...conversationHistory.slice(-10),
    { role: "user", content: userMessage },
  ];

  const stream = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages,
    max_completion_tokens: 500,
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      yield content;
    }
  }
}
