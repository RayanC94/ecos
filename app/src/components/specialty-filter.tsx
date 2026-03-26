"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const DES_GROUPS = [
  { id: 0, label: "Tous", short: "Tous" },
  { id: 1, label: "Chirurgie tête et cou", short: "Chir. tête/cou" },
  { id: 2, label: "Chirurgie hors tête et cou", short: "Chirurgie" },
  { id: 3, label: "Médecine de l'aigu (MAR/MIR/Urgences)", short: "Urgences" },
  { id: 4, label: "Radiologie / Médecine nucléaire", short: "Radiologie" },
  { id: 5, label: "Biologie / Génétique médicale", short: "Biologie" },
  { id: 6, label: "Santé publique / Médecine légale", short: "Santé pub." },
  { id: 7, label: "Endocrinologie / Nutrition / Gynécologie", short: "Endocrino" },
  { id: 8, label: "Spécialités médicales transversales", short: "Transversal" },
  { id: 9, label: "Psychiatrie / Neurologie / MPR", short: "Psychiatrie" },
  { id: 10, label: "Oncologie / HGE / Hématologie", short: "Oncologie" },
  { id: 11, label: "Pédiatrie", short: "Pédiatrie" },
  { id: 12, label: "Cardio / Pneumo / Néphro / Vasculaire", short: "Cardio" },
  { id: 13, label: "Médecine générale", short: "MG" },
];

interface SpecialtyFilterProps {
  selected: number;
  onSelect: (desGroup: number) => void;
  caseCounts?: Record<number, number>;
}

export function SpecialtyFilter({
  selected,
  onSelect,
  caseCounts = {},
}: SpecialtyFilterProps) {
  return (
    <div className="space-y-1">
      <h3 className="font-semibold text-sm text-gray-500 uppercase tracking-wider px-2 mb-3">
        Spécialités
      </h3>
      {DES_GROUPS.map((group) => {
        const count = group.id === 0
          ? Object.values(caseCounts).reduce((a, b) => a + b, 0)
          : caseCounts[group.id] ?? 0;

        return (
          <Button
            key={group.id}
            variant="ghost"
            className={cn(
              "w-full justify-between text-left h-auto py-2 px-3",
              selected === group.id && "bg-blue-50 text-blue-700 font-medium"
            )}
            onClick={() => onSelect(group.id)}
          >
            <span className="text-sm truncate">{group.short}</span>
            {count > 0 && (
              <span className="text-xs text-gray-400 ml-2">{count}</span>
            )}
          </Button>
        );
      })}
    </div>
  );
}

export { DES_GROUPS };
