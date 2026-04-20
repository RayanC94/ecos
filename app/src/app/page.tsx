import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between gap-2">
          <h1 className="text-base sm:text-xl font-bold text-blue-900 truncate">ECOS Simulateur</h1>
          <nav className="flex gap-1 sm:gap-4 shrink-0">
            <Link href="/cases">
              <Button variant="ghost" size="sm" className="text-xs sm:text-sm px-2 sm:px-3">
                Cas cliniques
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" className="text-xs sm:text-sm px-2 sm:px-3">
                Progression
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <main className="max-w-4xl mx-auto px-4 py-12 sm:py-24 text-center">
        <h2 className="text-2xl sm:text-4xl font-bold text-gray-900 mb-4 sm:mb-6">
          Entraînez-vous aux ECOS
          <br />
          <span className="text-blue-600">avec un patient simulé intelligent</span>
        </h2>

        <p className="text-base sm:text-lg text-gray-600 mb-8 sm:mb-10 max-w-2xl mx-auto">
          Pratiquez vos examens cliniques avec un patient IA qui répond comme un
          vrai patient. Recevez un feedback détaillé basé sur les grilles
          d&apos;évaluation officielles.
        </p>

        <div className="flex gap-4 justify-center mb-12 sm:mb-16">
          <Link href="/cases">
            <Button size="lg" className="text-base px-6 sm:px-8 h-12">
              Commencer un entraînement
            </Button>
          </Link>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-4 sm:gap-8 text-left mt-12 sm:mt-16">
          <div className="p-6 rounded-xl bg-white border">
            <div className="text-2xl mb-3">&#x1F3AF;</div>
            <h3 className="font-semibold text-gray-900 mb-2">
              Patient réaliste
            </h3>
            <p className="text-sm text-gray-600">
              Le patient ne donne que les informations demandées. Question
              précise = réponse complète. Question vague = réponse vague.
            </p>
          </div>

          <div className="p-6 rounded-xl bg-white border">
            <div className="text-2xl mb-3">&#x1F4CB;</div>
            <h3 className="font-semibold text-gray-900 mb-2">
              Grilles officielles
            </h3>
            <p className="text-sm text-gray-600">
              Évaluation basée sur les grilles TACFR/TUT&apos;ECOS. Chaque item
              est vérifié avec preuve tirée de votre consultation.
            </p>
          </div>

          <div className="p-6 rounded-xl bg-white border">
            <div className="text-2xl mb-3">&#x1F4C8;</div>
            <h3 className="font-semibold text-gray-900 mb-2">
              Feedback détaillé
            </h3>
            <p className="text-sm text-gray-600">
              Découvrez exactement ce que vous avez oublié, ce que vous avez
              bien fait, et comment progresser.
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 sm:gap-8 mt-12 sm:mt-16 py-6 sm:py-8 border-t">
          <div>
            <div className="text-2xl sm:text-3xl font-bold text-blue-600">426+</div>
            <div className="text-xs sm:text-sm text-gray-500 mt-1">Cas cliniques</div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-bold text-blue-600">13</div>
            <div className="text-xs sm:text-sm text-gray-500 mt-1">Spécialités</div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-bold text-blue-600">8 min</div>
            <div className="text-xs sm:text-sm text-gray-500 mt-1">Par station</div>
          </div>
        </div>
      </main>
    </div>
  );
}
