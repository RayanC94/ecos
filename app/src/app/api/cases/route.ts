import { NextRequest, NextResponse } from "next/server";
import { getPool, parseJsonField } from "@/lib/db";
import type { ECOSCase } from "@/types/case";

export async function GET(request: NextRequest) {
  try {
    const pool = getPool();
    const [rows] = await pool.query(
      "SELECT * FROM cases ORDER BY sdd_number"
    );

    const cases = (rows as Record<string, unknown>[]).map((row) => ({
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
    })) as ECOSCase[];

    return NextResponse.json({ cases });
  } catch (error) {
    console.error("Cases API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
