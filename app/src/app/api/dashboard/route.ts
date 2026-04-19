import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/db";

export async function GET() {
  try {
    const supabase = getSupabase();

    const { count: totalCases, error: cntErr } = await supabase
      .from("cases")
      .select("*", { count: "exact", head: true });
    if (cntErr) throw cntErr;

    // Recent evaluations joined with case info. Using the foreign-key relation.
    const { data, error } = await supabase
      .from("evaluations")
      .select("id, case_id, percentage, evaluated_at, cases!inner(title, sdd_number, specialty, des_group)")
      .order("evaluated_at", { ascending: false })
      .limit(20);

    if (error) throw error;

    type Row = {
      id: string;
      case_id: string;
      percentage: number;
      evaluated_at: string;
      cases: { title: string; sdd_number: number; specialty: string; des_group: number } | null;
    };
    const evaluations = (data ?? []) as unknown as Row[];

    const recentSessions = evaluations.map((e) => ({
      id: e.id,
      case_id: e.case_id,
      case_title: e.cases
        ? `SDD ${e.cases.sdd_number} — ${e.cases.title}`
        : "",
      percentage: Number(e.percentage),
      evaluated_at: e.evaluated_at,
    }));

    // Progress by DES group
    const progressMap = new Map<
      number,
      { specialty: string; scores: number[]; caseIds: Set<string> }
    >();

    for (const e of evaluations) {
      if (!e.cases) continue;
      const desGroup = e.cases.des_group;
      const existing = progressMap.get(desGroup);
      if (existing) {
        existing.scores.push(Number(e.percentage));
        existing.caseIds.add(e.case_id);
      } else {
        progressMap.set(desGroup, {
          specialty: e.cases.specialty,
          scores: [Number(e.percentage)],
          caseIds: new Set([e.case_id]),
        });
      }
    }

    const progress = Array.from(progressMap.entries()).map(
      ([des_group, data]) => ({
        des_group,
        specialty: data.specialty,
        cases_completed: data.caseIds.size,
        avg_score: Math.round(
          data.scores.reduce((a, b) => a + b, 0) / data.scores.length
        ),
      })
    );

    return NextResponse.json({
      totalCases: totalCases ?? 0,
      recentSessions,
      progress,
    });
  } catch (error) {
    console.error("Dashboard API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
