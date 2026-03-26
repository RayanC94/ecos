"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { DES_GROUPS } from "@/components/specialty-filter";

interface ProgressData {
  specialty: string;
  des_group: number;
  cases_completed: number;
  avg_score: number;
}

interface RecentSession {
  id: string;
  case_id: string;
  case_title: string;
  percentage: number;
  evaluated_at: string;
}

export default function DashboardPage() {
  const [progress, setProgress] = useState<ProgressData[]>([]);
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);
  const [totalCases, setTotalCases] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const res = await fetch("/api/dashboard");
        const data = await res.json();
        setTotalCases(data.totalCases ?? 0);
        setRecentSessions(data.recentSessions ?? []);
        setProgress(data.progress ?? []);
      } catch (error) {
        console.error("Failed to load dashboard:", error);
      }
      setLoading(false);
    }
    loadDashboard();
  }, []);

  const totalCompleted = progress.reduce((a, p) => a + p.cases_completed, 0);
  const overallAvg =
    progress.length > 0
      ? Math.round(
          progress.reduce((a, p) => a + p.avg_score, 0) / progress.length
        )
      : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-blue-900">
            ECOS Simulateur
          </Link>
          <nav className="flex gap-4">
            <Link href="/cases">
              <Button variant="ghost" size="sm">
                Cas cliniques
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" className="font-medium">
                Progression
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">Ma progression</h2>

        {loading ? (
          <div className="text-center py-12 text-gray-400">Chargement...</div>
        ) : (
          <>
            {/* Overview cards */}
            <div className="grid sm:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6 text-center">
                  <div className="text-3xl font-bold text-blue-600">
                    {totalCompleted}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    Cas complétés sur {totalCases}
                  </div>
                  <Progress
                    value={totalCases > 0 ? (totalCompleted / totalCases) * 100 : 0}
                    className="mt-3 h-2"
                  />
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6 text-center">
                  <div className="text-3xl font-bold text-green-600">
                    {overallAvg}%
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    Score moyen
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6 text-center">
                  <div className="text-3xl font-bold text-purple-600">
                    {progress.length}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    Spécialités couvertes sur 13
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Progress by specialty */}
            {progress.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Par spécialité</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {progress
                    .sort((a, b) => a.des_group - b.des_group)
                    .map((p) => {
                      const group = DES_GROUPS.find((g) => g.id === p.des_group);
                      return (
                        <div key={p.des_group}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="font-medium">
                              {group?.short ?? p.specialty}
                            </span>
                            <span className="text-gray-500">
                              {p.avg_score}% — {p.cases_completed} cas
                            </span>
                          </div>
                          <Progress value={p.avg_score} className="h-2" />
                        </div>
                      );
                    })}
                </CardContent>
              </Card>
            )}

            {/* Recent sessions */}
            {recentSessions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Sessions récentes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {recentSessions.map((session) => (
                      <div
                        key={session.id}
                        className="flex items-center justify-between py-2 border-b last:border-0"
                      >
                        <div>
                          <p className="text-sm font-medium">
                            {session.case_title}
                          </p>
                          <p className="text-xs text-gray-400">
                            {new Date(session.evaluated_at).toLocaleDateString(
                              "fr-FR",
                              {
                                day: "numeric",
                                month: "long",
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )}
                          </p>
                        </div>
                        <div
                          className={`text-sm font-bold ${
                            session.percentage >= 75
                              ? "text-green-600"
                              : session.percentage >= 50
                                ? "text-amber-600"
                                : "text-red-600"
                          }`}
                        >
                          {Math.round(session.percentage)}%
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {totalCompleted === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-400 mb-4">
                  Vous n&apos;avez pas encore complété de consultation.
                </p>
                <Link href="/cases">
                  <Button>Commencer un entraînement</Button>
                </Link>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
