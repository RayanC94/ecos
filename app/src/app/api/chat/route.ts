import { NextRequest } from "next/server";
import { streamPatientResponse } from "@/lib/patient-engine";
import { getSupabase, rowToCase } from "@/lib/db";
import type { ChatMessage } from "@/types/session";

export async function POST(request: NextRequest) {
  try {
    const { session_id, message, chat_history } = await request.json();

    if (!session_id || !message) {
      return new Response(JSON.stringify({ error: "Missing session_id or message" }), {
        status: 400,
      });
    }

    const supabase = getSupabase();

    const { data: session, error: sessErr } = await supabase
      .from("sessions")
      .select("case_id, status")
      .eq("id", session_id)
      .maybeSingle();

    if (sessErr) throw sessErr;
    if (!session) {
      return new Response(JSON.stringify({ error: "Session not found" }), { status: 404 });
    }
    if ((session as { status: string }).status !== "active") {
      return new Response(JSON.stringify({ error: "Session is not active" }), { status: 400 });
    }

    const { data: caseRow, error: caseErr } = await supabase
      .from("cases")
      .select("*")
      .eq("id", (session as { case_id: string }).case_id)
      .maybeSingle();

    if (caseErr) throw caseErr;
    if (!caseRow) {
      return new Response(JSON.stringify({ error: "Case not found" }), { status: 404 });
    }

    const caseData = rowToCase(caseRow as Record<string, unknown>);

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
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
}
