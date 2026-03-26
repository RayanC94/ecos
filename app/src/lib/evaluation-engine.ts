import { getAnthropicClient } from "./anthropic";
import { buildEvaluatorSystemPrompt } from "./prompt-templates";
import type { ECOSCase } from "@/types/case";
import type { ChatMessage } from "@/types/session";
import type { EvaluationResult } from "@/types/evaluation";

function formatTranscript(chatHistory: ChatMessage[]): string {
  return chatHistory
    .map((msg) => {
      const role = msg.role === "student" ? "Étudiant" : "Patient";
      return `[${role}] : ${msg.content}`;
    })
    .join("\n\n");
}

export async function evaluateSession(
  caseData: ECOSCase,
  sessionId: string,
  chatHistory: ChatMessage[]
): Promise<EvaluationResult> {
  const anthropic = getAnthropicClient();
  const systemPrompt = buildEvaluatorSystemPrompt(caseData);
  const transcript = formatTranscript(chatHistory);

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 3000,
    temperature: 0,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `Voici la transcription de la consultation ECOS à évaluer :\n\n${transcript}\n\nÉvalue cette consultation selon la grille d'évaluation fournie. Réponds en JSON.`,
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  const text = textBlock?.text ?? "{}";

  // Extract JSON from response (handle potential markdown wrapping)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Failed to parse evaluation response as JSON");
  }

  const parsed = JSON.parse(jsonMatch[0]);

  return {
    session_id: sessionId,
    case_id: caseData.id,
    task_scores: parsed.task_scores ?? [],
    communication_scores: parsed.communication_scores ?? [],
    total_score: parsed.total_score ?? 0,
    max_score: parsed.max_score ?? 0,
    percentage: parsed.percentage ?? 0,
    strengths: parsed.strengths ?? [],
    improvements: parsed.improvements ?? [],
    summary: parsed.summary ?? "",
  };
}
