import { NextRequest, NextResponse } from "next/server";
import { getSupabase, rowToCase } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: NextRequest) {
  try {
    const { case_id, user_id } = await request.json();

    if (!case_id) {
      return NextResponse.json({ error: "Missing case_id" }, { status: 400 });
    }

    const supabase = getSupabase();

    const { data: caseRow, error: caseErr } = await supabase
      .from("cases")
      .select("*")
      .eq("id", case_id)
      .maybeSingle();

    if (caseErr) throw caseErr;
    if (!caseRow) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }

    const sessionId = uuidv4();
    const { error: sessErr } = await supabase.from("sessions").insert({
      id: sessionId,
      case_id,
      user_id: user_id ?? null,
      status: "active",
      chat_history: [],
    });

    if (sessErr) throw sessErr;

    const fullCase = rowToCase(caseRow as Record<string, unknown>);
    const {
      evaluation_grid: _grid,
      reference_sheet: _ref,
      ...publicCase
    } = fullCase;
    void _grid;
    void _ref;

    return NextResponse.json({
      session: { id: sessionId, case_id, status: "active" },
      case_data: publicCase,
    });
  } catch (error) {
    console.error("Session start error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
