import { NextRequest, NextResponse } from "next/server";
import { getPool, parseJsonField } from "@/lib/db";
import { evaluateSession } from "@/lib/evaluation-engine";
import { v4 as uuidv4 } from "uuid";
import type { ECOSCase } from "@/types/case";
import type { ChatMessage } from "@/types/session";

export async function POST(request: NextRequest) {
  try {
    const { session_id } = await request.json();

    if (!session_id) {
      return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
    }

    const pool = getPool();

    // Get session
    const [sessionRows] = await pool.query(
      "SELECT * FROM sessions WHERE id = ?",
      [session_id]
    );
    const sessions = sessionRows as Record<string, unknown>[];
    if (sessions.length === 0) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const session = sessions[0];
    const chatHistory = parseJsonField<ChatMessage[]>(session.chat_history) ?? [];

    // Get case data
    const [caseRows] = await pool.query("SELECT * FROM cases WHERE id = ?", [session.case_id]);
    const cases = caseRows as Record<string, unknown>[];
    if (cases.length === 0) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }

    const row = cases[0];
    const caseData: ECOSCase = {
      id: row.id as string,
      sdd_number: row.sdd_number as number,
      subject_number: row.subject_number as number,
      title: row.title as string,
      specialty: row.specialty as string,
      des_group: row.des_group as number,
      format: row.format as ECOSCase["format"],
      source_pdf: row.source_pdf as string,
      metadata: parseJsonField(row.metadata),
      student_instructions: parseJsonField(row.student_instructions),
      patient: parseJsonField(row.patient),
      qa_pairs: parseJsonField(row.qa_pairs) ?? [],
      conditional_responses: parseJsonField(row.conditional_responses) ?? [],
      evaluation_grid: parseJsonField(row.evaluation_grid),
      reference_sheet: row.reference_sheet as string | undefined,
      iconography: parseJsonField(row.iconography) ?? [],
    };

    // Run evaluation
    const result = await evaluateSession(caseData, session_id, chatHistory);

    // Save evaluation
    const evalId = uuidv4();
    await pool.query(
      `INSERT INTO evaluations
        (id, session_id, case_id, user_id, task_scores, communication_scores,
         total_score, max_score, percentage, strengths, improvements, summary)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        evalId,
        session_id,
        session.case_id,
        session.user_id || null,
        JSON.stringify(result.task_scores),
        JSON.stringify(result.communication_scores),
        result.total_score,
        result.max_score,
        result.percentage,
        JSON.stringify(result.strengths),
        JSON.stringify(result.improvements),
        result.summary,
      ]
    );

    return NextResponse.json({ evaluation: result });
  } catch (error) {
    console.error("Evaluation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
