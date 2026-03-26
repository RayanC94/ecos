"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import type { EvaluationResult } from "@/types/evaluation";

interface ResultsSummaryProps {
  evaluation: EvaluationResult;
}

export function ResultsSummary({ evaluation }: ResultsSummaryProps) {
  const scoreColor =
    evaluation.percentage >= 75
      ? "text-green-600"
      : evaluation.percentage >= 50
        ? "text-amber-600"
        : "text-red-600";

  const scoreBg =
    evaluation.percentage >= 75
      ? "bg-green-50"
      : evaluation.percentage >= 50
        ? "bg-amber-50"
        : "bg-red-50";

  return (
    <div className="space-y-6">
      {/* Score Overview */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center gap-8">
            <div className={`text-center p-6 rounded-2xl ${scoreBg}`}>
              <div className={`text-5xl font-bold ${scoreColor}`}>
                {Math.round(evaluation.percentage)}%
              </div>
              <div className="text-sm text-gray-500 mt-1">
                {evaluation.total_score} / {evaluation.max_score} points
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Task Scores */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Aptitudes cliniques</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {evaluation.task_scores.map((task, i) => (
            <div key={i} className="flex items-start gap-3">
              <Badge
                variant={
                  task.status === "fait"
                    ? "default"
                    : task.status === "partiel"
                      ? "secondary"
                      : "destructive"
                }
                className="shrink-0 mt-0.5 text-xs min-w-[60px] justify-center"
              >
                {task.status === "fait"
                  ? "Fait"
                  : task.status === "partiel"
                    ? "Partiel"
                    : "Manqué"}
              </Badge>
              <div className="flex-1 min-w-0">
                <p className="text-sm">{task.description}</p>
                {task.evidence && task.status !== "non_fait" && (
                  <p className="text-xs text-gray-400 mt-0.5 italic">
                    {task.evidence}
                  </p>
                )}
              </div>
              <span className="text-sm font-medium shrink-0">
                {task.score}/{task.max_score}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Communication Scores */}
      {evaluation.communication_scores.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Communication</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {evaluation.communication_scores.map((comm, i) => (
              <div key={i}>
                <div className="flex justify-between text-sm mb-1">
                  <span>{comm.name}</span>
                  <span className="font-medium">
                    {comm.score} — {comm.label}
                  </span>
                </div>
                <Progress value={comm.score * 100} className="h-2" />
                {comm.justification && (
                  <p className="text-xs text-gray-400 mt-1">
                    {comm.justification}
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Feedback */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Feedback</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {evaluation.strengths.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-green-700 mb-2">
                Points forts
              </h4>
              <ul className="space-y-1">
                {evaluation.strengths.map((s, i) => (
                  <li key={i} className="text-sm text-gray-700 flex gap-2">
                    <span className="text-green-500 shrink-0">+</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {evaluation.strengths.length > 0 && evaluation.improvements.length > 0 && (
            <Separator />
          )}

          {evaluation.improvements.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-amber-700 mb-2">
                Axes d&apos;amélioration
              </h4>
              <ul className="space-y-1">
                {evaluation.improvements.map((imp, i) => (
                  <li key={i} className="text-sm text-gray-700 flex gap-2">
                    <span className="text-amber-500 shrink-0">-</span>
                    {imp}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {evaluation.summary && (
            <>
              <Separator />
              <p className="text-sm text-gray-600">{evaluation.summary}</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
