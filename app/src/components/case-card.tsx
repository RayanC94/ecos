"use client";

import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ECOSCase } from "@/types/case";

interface CaseCardProps {
  caseData: ECOSCase;
}

export function CaseCard({ caseData }: CaseCardProps) {
  const hasPatient = caseData.format !== "tacfa_no_patient";

  return (
    <Link href={`/cases/${caseData.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base leading-tight">
              {caseData.title}
            </CardTitle>
            <Badge
              variant={hasPatient ? "default" : "secondary"}
              className="shrink-0 text-xs"
            >
              {hasPatient ? "Avec patient" : "Sans patient"}
            </Badge>
          </div>
          <CardDescription className="text-xs">
            SDD {caseData.sdd_number} - {caseData.specialty}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap gap-1.5">
            {caseData.metadata.competency_domains.slice(0, 2).map((domain, i) => (
              <Badge key={i} variant="outline" className="text-xs font-normal">
                {domain}
              </Badge>
            ))}
            <Badge variant="outline" className="text-xs font-normal">
              {caseData.metadata.time_limit_minutes} min
            </Badge>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
