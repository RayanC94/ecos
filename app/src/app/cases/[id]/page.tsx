"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { ECOSCase } from "@/types/case";

export default function CaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [caseData, setCaseData] = useState<ECOSCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    async function loadCase() {
      try {
        const res = await fetch(`/api/cases/${params.id}`);
        const data = await res.json();
        if (data.case_data) setCaseData(data.case_data as ECOSCase);
      } catch (error) {
        console.error("Failed to load case:", error);
      }
      setLoading(false);
    }
    loadCase();
  }, [params.id]);

  async function startSession() {
    if (!caseData || starting) return;
    setStarting(true);

    try {
      const response = await fetch("/api/session/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ case_id: caseData.id }),
      });

      const data = await response.json();
      if (data.session?.id) {
        router.push(`/session/${data.session.id}`);
      }
    } catch (error) {
      console.error("Failed to start session:", error);
      setStarting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        Chargement...
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 mb-4">Cas non trouvé</p>
          <Link href="/cases">
            <Button variant="outline">Retour aux cas</Button>
          </Link>
        </div>
      </div>
    );
  }

  const hasPatient = caseData.format !== "tacfa_no_patient";

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/cases">
            <Button variant="ghost" size="sm">
              ← Retour
            </Button>
          </Link>
          <h1 className="text-lg font-bold text-gray-900 truncate">
            SDD {caseData.sdd_number} — {caseData.title}
          </h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Overview */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-xl">{caseData.title}</CardTitle>
                <p className="text-sm text-gray-500 mt-1">
                  {caseData.specialty} — DES n°{caseData.des_group}
                </p>
              </div>
              <Badge variant={hasPatient ? "default" : "secondary"}>
                {hasPatient ? "Avec patient simulé" : "Sans patient"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Metadata */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Durée :</span>{" "}
                <span className="font-medium">
                  {caseData.metadata.time_limit_minutes} minutes
                </span>
              </div>
              <div>
                <span className="text-gray-500">Format :</span>{" "}
                <span className="font-medium capitalize">
                  {caseData.format.replace(/_/g, " ")}
                </span>
              </div>
            </div>

            {/* Competency domains */}
            {caseData.metadata.competency_domains.length > 0 && (
              <div>
                <p className="text-sm text-gray-500 mb-2">
                  Domaines de compétence :
                </p>
                <div className="flex flex-wrap gap-2">
                  {caseData.metadata.competency_domains.map((d, i) => (
                    <Badge key={i} variant="outline">
                      {d}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            {/* Student instructions preview */}
            <div>
              <h3 className="font-medium text-sm mb-2">Contexte clinique</h3>
              <p className="text-sm text-gray-700 leading-relaxed">
                {caseData.student_instructions.context}
              </p>
            </div>

            {caseData.student_instructions.tasks.length > 0 && (
              <div>
                <h3 className="font-medium text-sm mb-2">Objectifs</h3>
                <ol className="list-decimal list-inside text-sm text-gray-700 space-y-1">
                  {caseData.student_instructions.tasks.map((task, i) => (
                    <li key={i}>{task}</li>
                  ))}
                </ol>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Evaluation grid preview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Grille d&apos;évaluation ({caseData.evaluation_grid.tasks.length}{" "}
              items)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500 mb-3">
              Vous serez évalué sur ces critères à la fin de la consultation :
            </p>
            <ul className="space-y-1.5">
              {caseData.evaluation_grid.tasks.slice(0, 5).map((task, i) => (
                <li key={i} className="text-sm text-gray-600 flex gap-2">
                  <span className="text-gray-300">•</span>
                  {task.description}
                </li>
              ))}
              {caseData.evaluation_grid.tasks.length > 5 && (
                <li className="text-sm text-gray-400 italic">
                  + {caseData.evaluation_grid.tasks.length - 5} autres critères
                </li>
              )}
            </ul>
          </CardContent>
        </Card>

        {/* Start button */}
        <div className="flex justify-center pt-4">
          {hasPatient ? (
            <Button
              size="lg"
              className="text-base px-12"
              onClick={startSession}
              disabled={starting}
            >
              {starting ? "Démarrage..." : "Commencer la consultation"}
            </Button>
          ) : (
            <div className="text-center text-gray-500">
              <p className="text-sm">
                Ce cas est une station sans patient simulé.
              </p>
              <p className="text-sm">
                Le mode raisonnement écrit sera disponible prochainement.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
