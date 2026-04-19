import { NextRequest, NextResponse } from "next/server";
import { getSupabase, rowToCase } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("cases")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }

    // Strip grid + reference sheet from the pre-session detail view too —
    // the student must not see them before the end.
    const fullCase = rowToCase(data as Record<string, unknown>);
    const {
      evaluation_grid: _grid,
      reference_sheet: _ref,
      ...publicCase
    } = fullCase;
    void _grid;
    void _ref;
    return NextResponse.json({ case_data: publicCase });
  } catch (error) {
    console.error("Case detail API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
