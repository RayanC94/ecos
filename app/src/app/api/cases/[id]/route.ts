import { NextRequest, NextResponse } from "next/server";
import { getPool, parseJsonField } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const pool = getPool();
    const [rows] = await pool.query("SELECT * FROM cases WHERE id = ?", [id]);

    const results = rows as Record<string, unknown>[];
    if (results.length === 0) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }

    const row = results[0];
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

    return NextResponse.json({ case_data: caseData });
  } catch (error) {
    console.error("Case detail API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
