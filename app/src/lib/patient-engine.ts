import { getAnthropicClient } from "./anthropic";
import { buildPatientSystemPrompt } from "./prompt-templates";
import type { ECOSCase } from "@/types/case";
import type { ChatMessage } from "@/types/session";

export async function generatePatientResponse(
  caseData: ECOSCase,
  chatHistory: ChatMessage[],
  studentMessage: string
): Promise<string> {
  const anthropic = getAnthropicClient();
  const systemPrompt = buildPatientSystemPrompt(caseData);

  // Convert chat history to Anthropic message format
  const messages = chatHistory.map((msg) => ({
    role: (msg.role === "student" ? "user" : "assistant") as "user" | "assistant",
    content: msg.content,
  }));

  // Add the current student message
  messages.push({ role: "user", content: studentMessage });

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 300,
    temperature: 0.3,
    system: systemPrompt,
    messages,
  });

  const textBlock = response.content.find((block) => block.type === "text");
  return textBlock?.text ?? "...";
}

export async function streamPatientResponse(
  caseData: ECOSCase,
  chatHistory: ChatMessage[],
  studentMessage: string
): Promise<ReadableStream> {
  const anthropic = getAnthropicClient();
  const systemPrompt = buildPatientSystemPrompt(caseData);

  const messages = chatHistory.map((msg) => ({
    role: (msg.role === "student" ? "user" : "assistant") as "user" | "assistant",
    content: msg.content,
  }));
  messages.push({ role: "user", content: studentMessage });

  const stream = await anthropic.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 300,
    temperature: 0.3,
    system: systemPrompt,
    messages,
  });

  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`)
          );
        }
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
}
