import { NextResponse } from "next/server";
import { getPool, parseJsonField } from "@/lib/db";

export async function GET() {
  try {
    const pool = getPool();

    // Total cases
    const [countRows] = await pool.query("SELECT COUNT(*) as total FROM cases");
    const totalCases = (countRows as Record<string, unknown>[])[0].total as number;

    // Recent evaluations with case info
    const [evalRows] = await pool.query(`
      SELECT e.id, e.case_id, e.percentage, e.evaluated_at,
             c.title, c.sdd_number, c.specialty, c.des_group
      FROM evaluations e
      JOIN cases c ON e.case_id = c.id
      ORDER BY e.evaluated_at DESC
      LIMIT 20
    `);

    const evaluations = evalRows as Record<string, unknown>[];

    const recentSessions = evaluations.map((e) => ({
      id: e.id,
      case_id: e.case_id,
      case_title: `SDD ${e.sdd_number} — ${e.title}`,
      percentage: Number(e.percentage),
      evaluated_at: e.evaluated_at,
    }));

    // Progress by specialty
    const progressMap = new Map<
      number,
      { specialty: string; scores: number[]; caseIds: Set<string> }
    >();

    for (const e of evaluations) {
      const desGroup = e.des_group as number;
      const existing = progressMap.get(desGroup);
      if (existing) {
        existing.scores.push(Number(e.percentage));
        existing.caseIds.add(e.case_id as string);
      } else {
        progressMap.set(desGroup, {
          specialty: e.specialty as string,
          scores: [Number(e.percentage)],
          caseIds: new Set([e.case_id as string]),
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
      totalCases,
      recentSessions,
      progress,
    });
  } catch (error) {
    console.error("Dashboard API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
