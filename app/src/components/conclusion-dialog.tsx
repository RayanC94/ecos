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

export function ConclusionDialog({
  open,
  onOpenChange,
  timeUp,
  remainingFormatted,
  submitting,
  onCancel,
  onSubmit,
}: ConclusionDialogProps) {
  const [conclusion, setConclusion] = useState("");

  const { isListening, isSupported, startListening, stopListening } =
    useSpeechInput(
      (segment) =>
        setConclusion((prev) => (prev ? prev.trim() + " " : "") + segment),
      { continuous: true }
    );

  function toggleMic() {
    if (isListening) stopListening();
    else startListening();
  }

  function handleSubmit() {
    if (isListening) stopListening();
    onSubmit({ conclusion: conclusion.trim() });
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
              ? "Le temps est écoulé. Conclusion optionnelle : dictez ou tapez librement (hypothèses, examens, prise en charge…). Si vous laissez vide, vous serez noté·e sur votre interrogatoire seul."
              : `Il vous reste ${remainingFormatted}. Conclusion optionnelle : dictez ou tapez librement (hypothèses, examens, prise en charge…). Si vous laissez vide, vous serez noté·e sur votre interrogatoire seul.`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 mt-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-gray-700">
              Conclusion
            </label>
            {isSupported && (
              <button
                type="button"
                onClick={toggleMic}
                disabled={submitting}
                className={`text-[11px] flex items-center gap-1 px-2 py-0.5 rounded ${
                  isListening
                    ? "bg-red-50 text-red-600 animate-pulse"
                    : "text-teal-700 hover:bg-teal-50"
                } disabled:opacity-40`}
              >
                {isListening ? (
                  <MicOff className="h-3 w-3" />
                ) : (
                  <Mic className="h-3 w-3" />
                )}
                {isListening ? "Écoute…" : "Dicter"}
              </button>
            )}
          </div>
          <textarea
            className="w-full min-h-[140px] rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            placeholder="Ex : suspicion de syndrome coronarien aigu ST+, je demande ECG et tropo, transfert USIC…"
            value={conclusion}
            onChange={(e) => setConclusion(e.target.value)}
            disabled={submitting}
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
            {submitting ? "Évaluation en cours…" : "Conclure et être évalué·e"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
