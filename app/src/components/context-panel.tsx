"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { ECOSCase } from "@/types/case";

interface ContextPanelProps {
  caseData: ECOSCase;
  autoCollapse?: boolean;
}

export function ContextPanel({ caseData, autoCollapse = false }: ContextPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const instructions = caseData.student_instructions;

  // When autoCollapse flips on (first student message), fold the panel
  // so the chat input remains visible without scrolling the whole page.
  useEffect(() => {
    if (autoCollapse) setIsCollapsed(true);
  }, [autoCollapse]);

  if (isCollapsed) {
    return (
      <div className="border-b bg-gray-50 px-3 sm:px-4 py-1.5 sm:py-2 flex items-center justify-between">
        <span className="text-xs sm:text-sm text-gray-500">Consignes masquées</span>
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
    <div className="border-b bg-blue-50/50 px-3 sm:px-6 py-3 sm:py-4 max-h-[40vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-2 sm:mb-3 gap-2">
        <h3 className="font-semibold text-xs sm:text-sm text-blue-900 min-w-0 truncate">
          Consignes - {caseData.title}
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsCollapsed(true)}
          className="text-xs shrink-0"
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
