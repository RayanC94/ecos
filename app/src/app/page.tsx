import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-blue-900">ECOS Simulateur</h1>
          <nav className="flex gap-4">
            <Link href="/cases">
              <Button variant="ghost" size="sm">
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

      {/* Hero */}
      <main className="max-w-4xl mx-auto px-4 py-24 text-center">
        <h2 className="text-4xl font-bold text-gray-900 mb-6">
          Entraînez-vous aux ECOS
          <br />
          <span className="text-blue-600">avec un patient simulé intelligent</span>
        </h2>

        <p className="text-lg text-gray-600 mb-10 max-w-2xl mx-auto">
          Pratiquez vos examens cliniques avec un patient IA qui répond comme un
          vrai patient. Recevez un feedback détaillé basé sur les grilles
          d&apos;évaluation officielles.
        </p>

        <div className="flex gap-4 justify-center mb-16">
          <Link href="/cases">
            <Button size="lg" className="text-base px-8">
              Commencer un entraînement
            </Button>
          </Link>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 text-left mt-16">
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
        <div className="grid grid-cols-3 gap-8 mt-16 py-8 border-t">
          <div>
            <div className="text-3xl font-bold text-blue-600">426+</div>
            <div className="text-sm text-gray-500 mt-1">Cas cliniques</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-blue-600">13</div>
            <div className="text-sm text-gray-500 mt-1">Spécialités</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-blue-600">8 min</div>
            <div className="text-sm text-gray-500 mt-1">Par station</div>
          </div>
        </div>
      </main>
    </div>
  );
}
