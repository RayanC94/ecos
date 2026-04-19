import { NextRequest, NextResponse } from "next/server";
import { getSupabase, rowToCase } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabase();

    const { data: session, error: sessErr } = await supabase
      .from("sessions")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (sessErr) throw sessErr;
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const { data: caseRow, error: caseErr } = await supabase
      .from("cases")
      .select("*")
      .eq("id", (session as { case_id: string }).case_id)
      .maybeSingle();

    if (caseErr) throw caseErr;
    if (!caseRow) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }

    // Strip spoilers from the payload sent to the student UI while
    // the session is active: the evaluation grid and the reference
    // sheet are answers that would telegraph what to ask.
    const fullCase = rowToCase(caseRow as Record<string, unknown>);
    const {
      evaluation_grid: _grid,
      reference_sheet: _ref,
      ...publicCase
    } = fullCase;
    void _grid;
    void _ref;

    return NextResponse.json({
      session: {
        id: (session as { id: string }).id,
        case_id: (session as { case_id: string }).case_id,
        status: (session as { status: string }).status,
      },
      case_data: publicCase,
    });
  } catch (error) {
    console.error("Sessions API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
