import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const supabase = getSupabase();

    const { data: evalRow, error: evalErr } = await supabase
      .from("evaluations")
      .select("*")
      .eq("session_id", sessionId)
      .maybeSingle();

    if (evalErr) throw evalErr;
    if (!evalRow) {
      return NextResponse.json({ error: "Evaluation not found" }, { status: 404 });
    }

    const e = evalRow as Record<string, unknown>;
    const evaluation = {
      session_id: e.session_id,
      case_id: e.case_id,
      task_scores: (e.task_scores as unknown[]) ?? [],
      communication_scores: (e.communication_scores as unknown[]) ?? [],
      total_score: Number(e.total_score ?? 0),
      max_score: Number(e.max_score ?? 0),
      percentage: Number(e.percentage ?? 0),
      strengths: (e.strengths as unknown[]) ?? [],
      improvements: (e.improvements as unknown[]) ?? [],
      summary: (e.summary as string) ?? "",
    };

    const { data: caseRow } = await supabase
      .from("cases")
      .select("title, sdd_number")
      .eq("id", e.case_id as string)
      .maybeSingle();

    const c = caseRow as { title?: string; sdd_number?: number } | null;
    const case_title = c ? `SDD ${c.sdd_number} — ${c.title}` : "";

    return NextResponse.json({ evaluation, case_title });
  } catch (error) {
    console.error("Evaluations API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
