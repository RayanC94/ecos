import { NextRequest, NextResponse } from "next/server";
import { getPool, parseJsonField } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const pool = getPool();

    // Get session
    const [sessionRows] = await pool.query(
      "SELECT * FROM sessions WHERE id = ?",
      [id]
    );
    const sessions = sessionRows as Record<string, unknown>[];
    if (sessions.length === 0) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const session = sessions[0];

    // Get case data
    const [caseRows] = await pool.query("SELECT * FROM cases WHERE id = ?", [
      session.case_id,
    ]);
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

    return NextResponse.json({
      session: {
        id: session.id,
        case_id: session.case_id,
        status: session.status,
      },
      case_data: caseData,
    });
  } catch (error) {
    console.error("Sessions API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
