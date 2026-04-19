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
  // Single-field conclusion: join any entries we find (typically one).
  const text = entries
    .map((e) => e.content.trim())
    .filter(Boolean)
    .join("\n");
  return { conclusion: text };
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

  // Enforce all-or-nothing scoring even if the model slips and returns
  // "partiel" or a fractional score. Tout-ou-rien: round down.
  const rawTasks: Array<{
    item_number?: number;
    description?: string;
    score?: number;
    max_score?: number;
    status?: string;
    evidence?: string;
  }> = Array.isArray(parsed.task_scores) ? parsed.task_scores : [];
  const task_scores = rawTasks.map((t) => {
    const max = Number(t.max_score ?? 1);
    const isFait = t.status === "fait" && Number(t.score ?? 0) >= max;
    return {
      item_number: Number(t.item_number ?? 0),
      description: String(t.description ?? ""),
      max_score: max,
      score: isFait ? max : 0,
      status: isFait ? ("fait" as const) : ("non_fait" as const),
      evidence: String(t.evidence ?? ""),
    };
  });

  // Recompute the total from the normalized tasks so displayed percentages
  // always match the displayed badges, regardless of what the model returned.
  const taskTotal = task_scores.reduce((s, t) => s + t.score, 0);
  const taskMax = task_scores.reduce((s, t) => s + t.max_score, 0);
  const conclusionScore = parsed.conclusion_score ?? null;
  const conclusionAdd =
    conclusionScore &&
    typeof conclusionScore.score === "number" &&
    typeof conclusionScore.max_score === "number"
      ? { score: conclusionScore.score, max: conclusionScore.max_score }
      : { score: 0, max: 0 };
  const total = taskTotal + conclusionAdd.score;
  const max = taskMax + conclusionAdd.max;
  const percentage = max > 0 ? Math.round((total / max) * 100) : 0;

  return {
    session_id: sessionId,
    case_id: caseData.id,
    task_scores,
    communication_scores: parsed.communication_scores ?? [],
    conclusion_score: conclusionScore,
    total_score: total,
    max_score: max,
    percentage,
    strengths: parsed.strengths ?? [],
    improvements: parsed.improvements ?? [],
    summary: parsed.summary ?? "",
  };
}
