import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const { session_id, chat_history, duration_seconds } = await request.json();

    if (!session_id) {
      return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
    }

    const pool = getPool();

    await pool.query(
      `UPDATE sessions
       SET status = 'completed', ended_at = NOW(), chat_history = ?, duration_seconds = ?
       WHERE id = ?`,
      [JSON.stringify(chat_history ?? []), duration_seconds ?? null, session_id]
    );

    return NextResponse.json({
      session: { id: session_id, status: "completed" },
    });
  } catch (error) {
    console.error("Session end error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
