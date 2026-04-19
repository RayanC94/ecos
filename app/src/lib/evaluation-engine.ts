import { getAnthropicClient } from "./anthropic";
import { buildEvaluatorSystemPrompt } from "./prompt-templates";
import type { ECOSCase } from "@/types/case";
import type { ChatMessage, StudentConclusion } from "@/types/session";
import type { EvaluationResult } from "@/types/evaluation";

function formatTranscript(chatHistory: ChatMessage[]): string {
  return chatHistory
    .filter((msg) => msg.role === "student" || msg.role === "patient")
    .map((msg) => {
      const role = msg.role === "student" ? "Étudiant" : "Patient";
      return `[${role}] : ${msg.content}`;
    })
    .join("\n\n");
}

export function extractConclusion(chatHistory: ChatMessage[]): StudentConclusion | null {
  const entries = chatHistory.filter((m) => m.role === "conclusion");
  if (entries.length === 0) return null;
  const out: StudentConclusion = { hypotheses: "", examens: "", prise_en_charge: "" };
  for (const e of entries) {
    if (e.conclusion_field && e.conclusion_field in out) {
      out[e.conclusion_field] = e.content;
    }
  }
  return out;
}

export async function evaluateSession(
  caseData: ECOSCase,
  sessionId: string,
  chatHistory: ChatMessage[]
): Promise<EvaluationResult> {
  const anthropic = getAnthropicClient();
  const conclusion = extractConclusion(chatHistory);
  const systemPrompt = buildEvaluatorSystemPrompt(caseData, conclusion);
  const transcript = formatTranscript(chatHistory);

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 3500,
    temperature: 0,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `Voici la transcription de la consultation ECOS à évaluer :\n\n${transcript}\n\nÉvalue cette consultation et la conclusion de l'étudiant selon la grille d'évaluation fournie. Réponds en JSON uniquement.`,
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  const text = textBlock?.text ?? "{}";

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
    conclusion_score: parsed.conclusion_score ?? null,
    total_score: parsed.total_score ?? 0,
    max_score: parsed.max_score ?? 0,
    percentage: parsed.percentage ?? 0,
    strengths: parsed.strengths ?? [],
    improvements: parsed.improvements ?? [],
    summary: parsed.summary ?? "",
  };
}
