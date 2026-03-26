"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ChatWindow } from "@/components/chat-window";
import { ContextPanel } from "@/components/context-panel";
import { Timer } from "@/components/timer";
import { useTimer } from "@/hooks/use-timer";
import { useChat } from "@/hooks/use-chat";
import type { ECOSCase } from "@/types/case";

export default function SessionPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const [caseData, setCaseData] = useState<ECOSCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [evaluating, setEvaluating] = useState(false);

  const { messages, isLoading: chatLoading, sendMessage, addSystemMessage } = useChat({
    sessionId,
  });

  const handleTimeUp = useCallback(() => {
    setSessionEnded(true);
    setShowEndDialog(true);
  }, []);

  const timer = useTimer({
    initialSeconds: (caseData?.metadata.time_limit_minutes ?? 8) * 60,
    onTimeUp: handleTimeUp,
  });

  // Load session and case data via API
  useEffect(() => {
    async function loadSession() {
      try {
        const res = await fetch(`/api/sessions/${sessionId}`);
        const data = await res.json();
        if (data.case_data) {
          setCaseData(data.case_data as ECOSCase);
        }
      } catch (error) {
        console.error("Failed to load session:", error);
      }
      setLoading(false);
    }
    loadSession();
  }, [sessionId]);

  // Start timer and send opening line when case loads
  useEffect(() => {
    if (caseData && !timer.isRunning && timer.secondsLeft > 0) {
      timer.start();
      if (caseData.patient?.opening_line) {
        addSystemMessage(caseData.patient.opening_line);
      }
    }
  }, [caseData]); // eslint-disable-line react-hooks/exhaustive-deps

  async function endSession() {
    setSessionEnded(true);
    timer.pause();

    // Save session
    await fetch("/api/session/end", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionId,
        chat_history: messages,
        duration_seconds: timer.elapsed,
      }),
    });

    // Trigger evaluation
    setEvaluating(true);
    try {
      const evalResponse = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      });

      if (evalResponse.ok) {
        router.push(`/session/${sessionId}/results`);
      }
    } catch (error) {
      console.error("Evaluation failed:", error);
      setEvaluating(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        Chargement de la consultation...
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 mb-4">Session non trouvée</p>
          <Link href="/cases">
            <Button variant="outline">Retour aux cas</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Header bar */}
      <header className="border-b bg-white px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/cases">
            <Button variant="ghost" size="sm">
              ←
            </Button>
          </Link>
          <div>
            <h1 className="font-semibold text-sm text-gray-900 truncate max-w-[300px]">
              SDD {caseData.sdd_number} — {caseData.title}
            </h1>
            <p className="text-xs text-gray-400">{caseData.specialty}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Timer
            formatted={timer.formatted}
            timerState={timer.timerState}
            isRunning={timer.isRunning}
          />
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowEndDialog(true)}
            disabled={sessionEnded}
          >
            Terminer
          </Button>
        </div>
      </header>

      {/* Context panel */}
      <ContextPanel caseData={caseData} />

      {/* Chat area */}
      <div className="flex-1 min-h-0">
        <ChatWindow
          messages={messages}
          onSend={sendMessage}
          isLoading={chatLoading}
          disabled={sessionEnded}
        />
      </div>

      {/* End session dialog */}
      <Dialog open={showEndDialog} onOpenChange={setShowEndDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {sessionEnded ? "Temps écoulé !" : "Terminer la consultation ?"}
            </DialogTitle>
            <DialogDescription>
              {sessionEnded
                ? "Le temps est écoulé. Votre consultation va être évaluée."
                : `Il vous reste ${timer.formatted}. Êtes-vous sûr de vouloir terminer ?`}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 justify-end mt-4">
            {!sessionEnded && (
              <Button
                variant="outline"
                onClick={() => setShowEndDialog(false)}
              >
                Continuer
              </Button>
            )}
            <Button
              onClick={endSession}
              disabled={evaluating}
            >
              {evaluating ? "Évaluation en cours..." : "Voir mes résultats"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
