"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { ECOSCase } from "@/types/case";

interface ContextPanelProps {
  caseData: ECOSCase;
}

export function ContextPanel({ caseData }: ContextPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const instructions = caseData.student_instructions;

  if (isCollapsed) {
    return (
      <div className="border-b bg-gray-50 px-4 py-2 flex items-center justify-between">
        <span className="text-sm text-gray-500">Consignes masquées</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsCollapsed(false)}
        >
          Afficher
        </Button>
      </div>
    );
  }

  return (
    <div className="border-b bg-blue-50/50 px-6 py-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm text-blue-900">
          Consignes - {caseData.title}
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsCollapsed(true)}
          className="text-xs"
        >
          Masquer
        </Button>
      </div>

      <p className="text-sm text-gray-700 mb-3">{instructions.context}</p>

      {instructions.tasks.length > 0 && (
        <div className="mb-2">
          <p className="text-xs font-medium text-blue-800 mb-1">
            Vous avez {caseData.metadata.time_limit_minutes} minutes pour :
          </p>
          <ol className="list-decimal list-inside text-sm text-gray-700 space-y-0.5">
            {instructions.tasks.map((task, i) => (
              <li key={i}>{task}</li>
            ))}
          </ol>
        </div>
      )}

      {instructions.constraints.length > 0 && (
        <div className="mt-2 p-2 bg-amber-50 rounded text-xs text-amber-800">
          <span className="font-medium">Vous ne devez pas :</span>
          <ul className="list-disc list-inside mt-1">
            {instructions.constraints.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
