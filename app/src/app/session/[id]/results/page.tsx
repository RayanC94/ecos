"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ResultsSummary } from "@/components/results-summary";
import type { EvaluationResult } from "@/types/evaluation";

export default function ResultsPage() {
  const params = useParams();
  const sessionId = params.id as string;

  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [caseTitle, setCaseTitle] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadResults() {
      try {
        // Try to get existing evaluation
        const res = await fetch(`/api/evaluations/${sessionId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.evaluation) {
            setEvaluation(data.evaluation);
            if (data.case_title) setCaseTitle(data.case_title);
            setLoading(false);
            return;
          }
        }
      } catch {
        // Evaluation doesn't exist yet
      }

      // Trigger evaluation
      try {
        const response = await fetch("/api/evaluate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId }),
        });
        const data = await response.json();
        if (data.evaluation) {
          setEvaluation(data.evaluation);
        }
      } catch {
        // Evaluation failed
      }
      setLoading(false);
    }
    loadResults();
  }, [sessionId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p>Évaluation en cours...</p>
          <p className="text-sm mt-1">Analyse de votre consultation</p>
        </div>
      </div>
    );
  }

  if (!evaluation) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 mb-4">Résultats non disponibles</p>
          <Link href="/cases">
            <Button variant="outline">Retour aux cas</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="max-w-3xl mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Link href="/cases">
              <Button variant="ghost" size="sm" className="shrink-0 text-xs sm:text-sm">
                <span className="sm:hidden">←</span>
                <span className="hidden sm:inline">← Cas cliniques</span>
              </Button>
            </Link>
            <h1 className="font-semibold text-sm sm:text-base text-gray-900 truncate min-w-0">
              Résultats{caseTitle ? ` — ${caseTitle}` : ""}
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-3 sm:px-4 py-5 sm:py-8">
        <ResultsSummary evaluation={evaluation} />

        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center mt-6 sm:mt-8 pb-6 sm:pb-8">
          <Link href={`/cases/${evaluation.case_id}`} className="w-full sm:w-auto">
            <Button variant="outline" className="w-full sm:w-auto">Recommencer ce cas</Button>
          </Link>
          <Link href="/cases" className="w-full sm:w-auto">
            <Button className="w-full sm:w-auto">Cas suivant</Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
