import { getAnthropicClient } from "./anthropic";
import { buildPatientSystemBlocks } from "./prompt-templates";
import type { ECOSCase } from "@/types/case";
import type { ChatMessage } from "@/types/session";

// Haiku 4.5: ~2× faster than Sonnet for the kind of short, constrained
// in-character replies this role-play produces — keeps oral back-and-forth
// snappy without losing faithfulness to the character sheet.
const MODEL = "claude-haiku-4-5-20251001";

export async function generatePatientResponse(
  caseData: ECOSCase,
  chatHistory: ChatMessage[],
  studentMessage: string
): Promise<string> {
  const anthropic = getAnthropicClient();

  const messages = chatHistory
    .filter((msg) => msg.role === "student" || msg.role === "patient")
    .map((msg) => ({
      role: (msg.role === "student" ? "user" : "assistant") as "user" | "assistant",
      content: msg.content,
    }));
  messages.push({ role: "user", content: studentMessage });

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 300,
    temperature: 0.3,
    system: buildPatientSystemBlocks(caseData),
    messages,
  });

  if (response.usage) {
    const u = response.usage;
    console.log(
      `[patient-engine] usage: in=${u.input_tokens} out=${u.output_tokens} cache_create=${u.cache_creation_input_tokens ?? 0} cache_read=${u.cache_read_input_tokens ?? 0}`
    );
  }

  const textBlock = response.content.find((block) => block.type === "text");
  return textBlock?.text ?? "...";
}

export async function streamPatientResponse(
  caseData: ECOSCase,
  chatHistory: ChatMessage[],
  studentMessage: string
): Promise<ReadableStream> {
  const anthropic = getAnthropicClient();

  const messages = chatHistory
    .filter((msg) => msg.role === "student" || msg.role === "patient")
    .map((msg) => ({
      role: (msg.role === "student" ? "user" : "assistant") as "user" | "assistant",
      content: msg.content,
    }));
  messages.push({ role: "user", content: studentMessage });

  const stream = await anthropic.messages.stream({
    model: MODEL,
    max_tokens: 300,
    temperature: 0.3,
    system: buildPatientSystemBlocks(caseData),
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
      // Log cache usage after the stream completes.
      try {
        const finalMessage = await stream.finalMessage();
        const u = finalMessage.usage;
        if (u) {
          console.log(
            `[patient-engine] usage: in=${u.input_tokens} out=${u.output_tokens} cache_create=${u.cache_creation_input_tokens ?? 0} cache_read=${u.cache_read_input_tokens ?? 0}`
          );
        }
      } catch {
        // ignore
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
}
