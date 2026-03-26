import { NextRequest, NextResponse } from "next/server";
import { getPool, parseJsonField } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const pool = getPool();

    const [rows] = await pool.query(
      "SELECT * FROM evaluations WHERE session_id = ? LIMIT 1",
      [sessionId]
    );

    const results = rows as Record<string, unknown>[];
    if (results.length === 0) {
      return NextResponse.json({ error: "Evaluation not found" }, { status: 404 });
    }

    const row = results[0];
    const evaluation = {
      session_id: row.session_id,
      case_id: row.case_id,
      task_scores: parseJsonField(row.task_scores) ?? [],
      communication_scores: parseJsonField(row.communication_scores) ?? [],
      total_score: Number(row.total_score),
      max_score: Number(row.max_score),
      percentage: Number(row.percentage),
      strengths: parseJsonField(row.strengths) ?? [],
      improvements: parseJsonField(row.improvements) ?? [],
      summary: row.summary ?? "",
    };

    // Get case title
    const [caseRows] = await pool.query(
      "SELECT title, sdd_number FROM cases WHERE id = ?",
      [row.case_id]
    );
    const caseInfo = (caseRows as Record<string, unknown>[])[0];

    return NextResponse.json({
      evaluation,
      case_title: caseInfo
        ? `SDD ${caseInfo.sdd_number} — ${caseInfo.title}`
        : "",
    });
  } catch (error) {
    console.error("Evaluations API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
