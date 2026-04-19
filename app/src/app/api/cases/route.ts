import { NextResponse } from "next/server";
import { getSupabase, rowToCase } from "@/lib/db";

export async function GET() {
  try {
    const supabase = getSupabase();
    // Only expose playable cases: tacfa_patient format with a populated opening_line.
    // Other formats (tutecos, tacfa_no_patient) stay in the DB but are hidden from the
    // student-facing list until we build the right UX for them.
    const { data, error } = await supabase
      .from("cases")
      .select("*")
      .eq("format", "tacfa_patient")
      .not("patient", "is", null)
      .order("sdd_number", { ascending: true });

    if (error) throw error;

    const rows = (data ?? []) as Record<string, unknown>[];
    const cases = rows
      .filter((r) => {
        const p = r.patient as { opening_line?: string } | null;
        return !!p?.opening_line && p.opening_line.trim().length > 0;
      })
      .map(rowToCase);

    return NextResponse.json({ cases });
  } catch (error) {
    console.error("Cases API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
