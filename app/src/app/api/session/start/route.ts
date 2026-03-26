import { NextRequest, NextResponse } from "next/server";
import { getPool, parseJsonField } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: NextRequest) {
  try {
    const { case_id, user_id } = await request.json();

    if (!case_id) {
      return NextResponse.json({ error: "Missing case_id" }, { status: 400 });
    }

    const pool = getPool();

    // Verify case exists
    const [caseRows] = await pool.query("SELECT * FROM cases WHERE id = ?", [case_id]);
    const cases = caseRows as Record<string, unknown>[];
    if (cases.length === 0) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }

    const row = cases[0];
    const caseData = {
      id: row.id,
      sdd_number: row.sdd_number,
      subject_number: row.subject_number,
      title: row.title,
      specialty: row.specialty,
      des_group: row.des_group,
      format: row.format,
      source_pdf: row.source_pdf,
      metadata: parseJsonField(row.metadata),
      student_instructions: parseJsonField(row.student_instructions),
      patient: parseJsonField(row.patient),
      qa_pairs: parseJsonField(row.qa_pairs),
      conditional_responses: parseJsonField(row.conditional_responses),
      evaluation_grid: parseJsonField(row.evaluation_grid),
      reference_sheet: row.reference_sheet,
      iconography: parseJsonField(row.iconography),
    };

    // Create session
    const sessionId = uuidv4();
    await pool.query(
      `INSERT INTO sessions (id, case_id, user_id, status, chat_history)
       VALUES (?, ?, ?, 'active', '[]')`,
      [sessionId, case_id, user_id || null]
    );

    return NextResponse.json({
      session: { id: sessionId, case_id, status: "active" },
      case_data: caseData,
    });
  } catch (error) {
    console.error("Session start error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
