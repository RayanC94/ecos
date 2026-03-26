"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CaseCard } from "@/components/case-card";
import { SpecialtyFilter } from "@/components/specialty-filter";
import type { ECOSCase } from "@/types/case";

export default function CasesPage() {
  const [cases, setCases] = useState<ECOSCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDes, setSelectedDes] = useState(0);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function loadCases() {
      try {
        const res = await fetch("/api/cases");
        const data = await res.json();
        if (data.cases) setCases(data.cases);
      } catch (error) {
        console.error("Failed to load cases:", error);
      }
      setLoading(false);
    }
    loadCases();
  }, []);

  const caseCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    for (const c of cases) {
      counts[c.des_group] = (counts[c.des_group] || 0) + 1;
    }
    return counts;
  }, [cases]);

  const filteredCases = useMemo(() => {
    let result = cases;

    if (selectedDes !== 0) {
      result = result.filter((c) => c.des_group === selectedDes);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.specialty.toLowerCase().includes(q) ||
          String(c.sdd_number).includes(q)
      );
    }

    return result;
  }, [cases, selectedDes, search]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-blue-900">
            ECOS Simulateur
          </Link>
          <nav className="flex gap-4">
            <Link href="/cases">
              <Button variant="ghost" size="sm" className="font-medium">
                Cas cliniques
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">
                Progression
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 flex gap-6">
        {/* Sidebar */}
        <aside className="w-64 shrink-0 hidden lg:block">
          <div className="sticky top-6">
            <SpecialtyFilter
              selected={selectedDes}
              onSelect={setSelectedDes}
              caseCounts={caseCounts}
            />
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Cas cliniques
            </h2>
            <Input
              placeholder="Rechercher un cas (titre, spécialité, SDD)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-md"
            />
          </div>

          {/* Mobile specialty selector */}
          <div className="lg:hidden mb-4 flex gap-2 overflow-x-auto pb-2">
            <Button
              variant={selectedDes === 0 ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedDes(0)}
            >
              Tous
            </Button>
            {Array.from({ length: 13 }, (_, i) => i + 1).map((des) => (
              <Button
                key={des}
                variant={selectedDes === des ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedDes(des)}
                className="shrink-0"
              >
                DES {des}
              </Button>
            ))}
          </div>

          {loading ? (
            <div className="text-center py-12 text-gray-400">
              Chargement des cas...
            </div>
          ) : filteredCases.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              Aucun cas trouvé.
              {cases.length === 0 && (
                <p className="mt-2 text-sm">
                  Les cas n&apos;ont pas encore été importés dans la base de données.
                </p>
              )}
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredCases.map((c) => (
                <CaseCard key={c.id} caseData={c} />
              ))}
            </div>
          )}

          <div className="mt-4 text-sm text-gray-400">
            {filteredCases.length} cas affichés sur {cases.length}
          </div>
        </main>
      </div>
    </div>
  );
}
