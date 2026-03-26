import { NextRequest } from "next/server";
import { streamPatientResponse } from "@/lib/patient-engine";
import { getPool, parseJsonField } from "@/lib/db";
import type { ECOSCase } from "@/types/case";
import type { ChatMessage } from "@/types/session";

export async function POST(request: NextRequest) {
  try {
    const { session_id, message, chat_history } = await request.json();

    if (!session_id || !message) {
      return new Response(JSON.stringify({ error: "Missing session_id or message" }), {
        status: 400,
      });
    }

    const pool = getPool();

    // Get session
    const [sessionRows] = await pool.query(
      "SELECT case_id, status FROM sessions WHERE id = ?",
      [session_id]
    );
    const sessions = sessionRows as Record<string, unknown>[];
    if (sessions.length === 0) {
      return new Response(JSON.stringify({ error: "Session not found" }), { status: 404 });
    }

    const session = sessions[0];
    if (session.status !== "active") {
      return new Response(JSON.stringify({ error: "Session is not active" }), { status: 400 });
    }

    // Get case data
    const [caseRows] = await pool.query("SELECT * FROM cases WHERE id = ?", [session.case_id]);
    const cases = caseRows as Record<string, unknown>[];
    if (cases.length === 0) {
      return new Response(JSON.stringify({ error: "Case not found" }), { status: 404 });
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

    // Stream the patient response
    const stream = await streamPatientResponse(
      caseData,
      (chat_history ?? []) as ChatMessage[],
      message
    );

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500 }
    );
  }
}
