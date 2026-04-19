import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const { session_id, chat_history, duration_seconds } = await request.json();

    if (!session_id) {
      return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
    }

    const supabase = getSupabase();
    const { error } = await supabase
      .from("sessions")
      .update({
        status: "completed",
        ended_at: new Date().toISOString(),
        chat_history: chat_history ?? [],
        duration_seconds: duration_seconds ?? null,
      })
      .eq("id", session_id);

    if (error) throw error;

    return NextResponse.json({
      session: { id: session_id, status: "completed" },
    });
  } catch (error) {
    console.error("Session end error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
