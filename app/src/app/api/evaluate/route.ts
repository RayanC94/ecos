import { NextRequest, NextResponse } from "next/server";
import { getSupabase, rowToCase } from "@/lib/db";
import { evaluateSession } from "@/lib/evaluation-engine";
import { v4 as uuidv4 } from "uuid";
import type { ChatMessage } from "@/types/session";

export async function POST(request: NextRequest) {
  try {
    const { session_id } = await request.json();

    if (!session_id) {
      return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
    }

    const supabase = getSupabase();

    const { data: session, error: sessErr } = await supabase
      .from("sessions")
      .select("*")
      .eq("id", session_id)
      .maybeSingle();

    if (sessErr) throw sessErr;
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const s = session as { case_id: string; user_id: string | null; chat_history: ChatMessage[] | null };
    const chatHistory = s.chat_history ?? [];

    const { data: caseRow, error: caseErr } = await supabase
      .from("cases")
      .select("*")
      .eq("id", s.case_id)
      .maybeSingle();

    if (caseErr) throw caseErr;
    if (!caseRow) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }

    const caseData = rowToCase(caseRow as Record<string, unknown>);
    const result = await evaluateSession(caseData, session_id, chatHistory);

    const { error: insErr } = await supabase.from("evaluations").insert({
      id: uuidv4(),
      session_id,
      case_id: s.case_id,
      user_id: s.user_id,
      task_scores: result.task_scores,
      communication_scores: result.communication_scores,
      total_score: result.total_score,
      max_score: result.max_score,
      percentage: result.percentage,
      strengths: result.strengths,
      improvements: result.improvements,
      summary: result.summary,
    });

    if (insErr) throw insErr;

    return NextResponse.json({ evaluation: result });
  } catch (error) {
    console.error("Evaluation error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
