"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Mic, MicOff } from "lucide-react";
import { useSpeechInput } from "@/hooks/use-speech-input";
import type { StudentConclusion } from "@/types/session";

interface ConclusionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  timeUp: boolean;
  remainingFormatted: string;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (conclusion: StudentConclusion) => void;
}

type FieldKey = "hypotheses" | "examens" | "prise_en_charge";

interface ConclusionFieldProps {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  activeMic: FieldKey | null;
  setActiveMic: (v: FieldKey | null) => void;
  fieldKey: FieldKey;
}

function ConclusionField({
  label,
  placeholder,
  value,
  onChange,
  disabled,
  activeMic,
  setActiveMic,
  fieldKey,
}: ConclusionFieldProps) {
  const { isListening, isSupported, startListening, stopListening } =
    useSpeechInput(
      (segment) => onChange((value ? value.trim() + " " : "") + segment),
      {
        continuous: true,
        onEnd: () => setActiveMic(null),
      }
    );
  const micActive = activeMic === fieldKey && isListening;

  function toggleMic() {
    if (isListening) {
      stopListening();
      setActiveMic(null);
    } else {
      setActiveMic(fieldKey);
      startListening();
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-gray-700">{label}</label>
        {isSupported && (
          <button
            type="button"
            onClick={toggleMic}
            disabled={disabled || (activeMic !== null && activeMic !== fieldKey)}
            className={`text-[11px] flex items-center gap-1 px-2 py-0.5 rounded ${
              micActive
                ? "bg-red-50 text-red-600 animate-pulse"
                : "text-teal-700 hover:bg-teal-50"
            } disabled:opacity-40`}
          >
            {micActive ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
            {micActive ? "Écoute…" : "Dicter"}
          </button>
        )}
      </div>
      <textarea
        className="w-full min-h-[72px] rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
    </div>
  );
}

export function ConclusionDialog({
  open,
  onOpenChange,
  timeUp,
  remainingFormatted,
  submitting,
  onCancel,
  onSubmit,
}: ConclusionDialogProps) {
  const [hypotheses, setHypotheses] = useState("");
  const [examens, setExamens] = useState("");
  const [priseEnCharge, setPriseEnCharge] = useState("");
  const [activeMic, setActiveMic] = useState<FieldKey | null>(null);

  function handleSubmit() {
    onSubmit({
      hypotheses: hypotheses.trim(),
      examens: examens.trim(),
      prise_en_charge: priseEnCharge.trim(),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-lg sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {timeUp ? "Temps écoulé — concluez votre cas" : "Conclusion du cas"}
          </DialogTitle>
          <DialogDescription>
            {timeUp
              ? "Le temps est écoulé. Remplissez ce que vous voulez (tout est optionnel) puis validez — l'évaluation se base sur toute la consultation et votre conclusion."
              : `Il vous reste ${remainingFormatted}. Remplissez ce que vous voulez (tout est optionnel) — l'évaluation se base sur toute la consultation et votre conclusion.`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 mt-2">
          <ConclusionField
            fieldKey="hypotheses"
            label="Hypothèses diagnostiques"
            placeholder="Principales hypothèses que vous retenez à l'issue de l'interrogatoire / examen…"
            value={hypotheses}
            onChange={setHypotheses}
            disabled={submitting}
            activeMic={activeMic}
            setActiveMic={setActiveMic}
          />
          <ConclusionField
            fieldKey="examens"
            label="Examens complémentaires à demander"
            placeholder="Biologie, imagerie, autres (ECG, ETT, ponction…)"
            value={examens}
            onChange={setExamens}
            disabled={submitting}
            activeMic={activeMic}
            setActiveMic={setActiveMic}
          />
          <ConclusionField
            fieldKey="prise_en_charge"
            label="Prise en charge / thérapeutique"
            placeholder="Orientation, traitement initial, surveillance, avis spécialisé…"
            value={priseEnCharge}
            onChange={setPriseEnCharge}
            disabled={submitting}
            activeMic={activeMic}
            setActiveMic={setActiveMic}
          />
        </div>

        <div className="flex gap-2 justify-end mt-3">
          {!timeUp && (
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={submitting}
            >
              Retour
            </Button>
          )}
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 sm:flex-none"
          >
            {submitting ? "Évaluation en cours…" : "Valider et être évalué·e"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
