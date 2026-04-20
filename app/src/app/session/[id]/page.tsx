"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChatWindow } from "@/components/chat-window";
import { ContextPanel } from "@/components/context-panel";
import { AnnexesPanel, annexRevealRegex } from "@/components/annexes-panel";
import { ConclusionDialog } from "@/components/conclusion-dialog";
import { Timer } from "@/components/timer";
import { useTimer } from "@/hooks/use-timer";
import { useChat } from "@/hooks/use-chat";
import { usePatientTts } from "@/hooks/use-patient-tts";
import { useSpeechInput, addQuestionMark } from "@/hooks/use-speech-input";
import { cleanOpeningLine } from "@/lib/prompt-templates";
import { Mic, MicOff, Eye, EyeOff, RefreshCw } from "lucide-react";
import type { ECOSCase } from "@/types/case";
import type { ChatMessage, StudentConclusion } from "@/types/session";

export default function SessionPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const [caseData, setCaseData] = useState<ECOSCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [showConclusion, setShowConclusion] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [highlightedAnnex, setHighlightedAnnex] = useState<string | null>(null);
  const [revealedAnnexes, setRevealedAnnexes] = useState<Set<string>>(
    () => new Set()
  );
  const [conversationMode, setConversationMode] = useState(false);
  const [examMode, setExamMode] = useState(false);

  const conversationModeRef = useRef(conversationMode);
  conversationModeRef.current = conversationMode;

  // Whether the most recent SR session produced a valid segment that was
  // auto-sent. If true, don't restart SR in onEnd — let the TTS chain do it
  // once the patient has finished speaking. If false, we recovered from
  // noise/silence and need to restart the mic ourselves.
  const justSentRef = useRef(false);
  // Mirror of chat-loading for use inside non-reactive callbacks.
  const chatLoadingRef = useRef(false);

  const {
    setTtsEnabled,
    speakText,
    cancelSpeech,
    isSpeaking,
    rate: ttsRate,
    setRate: setTtsRate,
  } = usePatientTts();

  const isSpeakingRef = useRef(isSpeaking);
  isSpeakingRef.current = isSpeaking;

  const revealMatchingAnnexes = useCallback(
    (text: string) => {
      const annexes = caseData?.iconography;
      if (!annexes) return;
      const toReveal: string[] = [];
      for (const a of annexes) {
        if (!a.url) continue;
        const re = annexRevealRegex(a);
        if (re && re.test(text)) toReveal.push(a.filename);
      }
      if (toReveal.length > 0) {
        setRevealedAnnexes((prev) => {
          const next = new Set(prev);
          for (const f of toReveal) next.add(f);
          return next;
        });
        setHighlightedAnnex(toReveal[0]);
        setTimeout(() => setHighlightedAnnex(null), 5000);
      }
    },
    [caseData]
  );

  const convoListenerRef = useRef<{
    start: () => void;
    stop: () => void;
  } | null>(null);

  const { messages, isLoading: chatLoading, sendMessage, addSystemMessage } =
    useChat({
      sessionId,
      storageKey: `ecos-messages-${sessionId}`,
      onStudentMessage: (text) => revealMatchingAnnexes(text),
      onPatientResponse: (text) => {
        justSentRef.current = false;
        // Make sure the mic is muted BEFORE TTS starts — otherwise the
        // speaker output leaks back into the microphone and the AI "hears"
        // itself, triggering a self-reply loop.
        convoListenerRef.current?.stop();
        speakText(text, () => {
          if (!conversationModeRef.current) return;
          // Short pause so the speaker audio fully stops before we re-arm
          // the mic. Without this, tail-end echoes can still be captured.
          setTimeout(() => {
            if (
              conversationModeRef.current &&
              !isSpeakingRef.current &&
              !chatLoadingRef.current
            ) {
              convoListenerRef.current?.start();
            }
          }, 450);
        });
        revealMatchingAnnexes(text);
      },
    });

  useEffect(() => {
    chatLoadingRef.current = chatLoading;
  }, [chatLoading]);

  // Speech listener for conversation mode. `continuous: false` so the
  // browser's built-in silence detection ends the utterance for us — then
  // we either auto-send (if a real phrase was captured) or restart the mic
  // (if only noise/silence was detected) so we never get stuck.
  const convoSpeech = useSpeechInput(
    (segment) => {
      if (!conversationModeRef.current) return;
      const text = addQuestionMark(segment.trim());
      if (!text) return;
      justSentRef.current = true;
      sendMessage(text);
    },
    {
      continuous: false,
      onEnd: () => {
        if (!conversationModeRef.current) return;
        if (justSentRef.current) return;
        // No valid segment was produced — restart listening after a short
        // pause so the browser releases the recognition session cleanly.
        // Don't restart while TTS is speaking (self-echo prevention).
        setTimeout(() => {
          if (
            conversationModeRef.current &&
            !chatLoadingRef.current &&
            !isSpeakingRef.current &&
            convoListenerRef.current
          ) {
            convoListenerRef.current.start();
          }
        }, 350);
      },
    }
  );

  useEffect(() => {
    convoListenerRef.current = {
      start: convoSpeech.startListening,
      stop: convoSpeech.stopListening,
    };
  }, [convoSpeech.startListening, convoSpeech.stopListening]);

  const handleTimeUp = useCallback(() => {
    setSessionEnded(true);
    setShowConclusion(true);
  }, []);

  const timer = useTimer({
    initialSeconds: (caseData?.metadata.time_limit_minutes ?? 8) * 60,
    onTimeUp: handleTimeUp,
    storageKey: `ecos-timer-${sessionId}`,
  });

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

  useEffect(() => {
    if (caseData && !timer.isRunning && timer.secondsLeft > 0) {
      timer.start();
      const tasksText = (caseData.student_instructions?.tasks ?? [])
        .join(" ")
        .toLowerCase();
      const briefedAboutAnnexes =
        /iconograph|annexe|document|imagerie|bilan/.test(tasksText);
      const initial = (caseData.iconography ?? [])
        .filter((a) => a.url && (a.initially_visible || briefedAboutAnnexes))
        .map((a) => a.filename);
      if (initial.length > 0) {
        setRevealedAnnexes(new Set(initial));
      }
      if (caseData.patient?.opening_line && messages.length === 0) {
        const opening = cleanOpeningLine(caseData.patient.opening_line);
        addSystemMessage(opening);
        revealMatchingAnnexes(opening);
      }
    }
  }, [caseData]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (conversationMode) {
      setTtsEnabled(true);
      justSentRef.current = false;
      const t = setTimeout(() => convoSpeech.startListening(), 50);
      return () => clearTimeout(t);
    }
    setTtsEnabled(false);
    cancelSpeech();
    convoSpeech.stopListening();
  }, [conversationMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Watchdog: if conversation mode is on but nothing is listening and
  // nothing is being processed, force-restart the mic after a brief delay.
  // This unwedges the "stuck in 'Le patient répond'" state.
  // Crucially: DON'T restart while TTS is speaking — the mic would
  // capture the patient's own voice and trigger a self-reply loop.
  useEffect(() => {
    if (!conversationMode) return;
    if (convoSpeech.isListening) return;
    if (chatLoading) return;
    if (isSpeaking) return;
    const t = setTimeout(() => {
      if (
        conversationModeRef.current &&
        !chatLoadingRef.current &&
        !isSpeakingRef.current &&
        convoListenerRef.current
      ) {
        convoListenerRef.current.start();
      }
    }, 2500);
    return () => clearTimeout(t);
  }, [conversationMode, convoSpeech.isListening, chatLoading, isSpeaking]);

  function manualRestartListening() {
    cancelSpeech();
    justSentRef.current = false;
    convoSpeech.stopListening();
    setTimeout(() => convoSpeech.startListening(), 250);
  }

  const hasStarted = messages.some((m) => m.role === "student");

  async function submitConclusion(conclusion: StudentConclusion) {
    setSessionEnded(true);
    timer.pause();
    cancelSpeech();
    convoSpeech.stopListening();
    setConversationMode(false);
    setEvaluating(true);

    const now = Date.now();
    // Always push one conclusion entry, even if empty — keeps the schema
    // consistent and lets the evaluator distinguish "no conclusion" from
    // "session never reached the wrap-up step".
    const conclusionEntry: ChatMessage = {
      id: crypto.randomUUID(),
      role: "conclusion",
      content: conclusion.conclusion,
      timestamp: now,
      conclusion_field: "conclusion",
    };
    const fullHistory = [...messages, conclusionEntry];

    try {
      await fetch("/api/session/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          chat_history: fullHistory,
          duration_seconds: timer.elapsed,
        }),
      });

      const evalResponse = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      });

      if (evalResponse.ok) {
        try {
          window.localStorage.removeItem(`ecos-timer-${sessionId}`);
          window.localStorage.removeItem(`ecos-messages-${sessionId}`);
        } catch {
          // ignore
        }
        router.push(`/session/${sessionId}/results`);
      } else {
        setEvaluating(false);
        console.error("Evaluation failed:", await evalResponse.text());
      }
    } catch (error) {
      console.error("Evaluation failed:", error);
      setEvaluating(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center text-gray-400">
        Chargement de la consultation...
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 mb-4">Session non trouvée</p>
          <Link href="/cases">
            <Button variant="outline">Retour aux cas</Button>
          </Link>
        </div>
      </div>
    );
  }

  const oralModeStatus = conversationMode
    ? isSpeaking
      ? "speaking"
      : chatLoading
        ? "thinking"
        : convoSpeech.isListening
          ? "listening"
          : "thinking"
    : "off";

  return (
    <div className="h-dvh flex flex-col bg-white overflow-hidden">
      <header className="border-b bg-white px-2 py-2 sm:px-4 sm:py-3 flex items-center justify-between shrink-0 gap-2">
        <div className="flex items-center gap-1 sm:gap-2 min-w-0 flex-1">
          <Link href="/cases">
            <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 text-base">
              ←
            </Button>
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="font-semibold text-xs sm:text-sm text-gray-900 truncate">
              <span className="sm:hidden">SDD {caseData.sdd_number}</span>
              <span className="hidden sm:inline">SDD {caseData.sdd_number} — {caseData.title}</span>
            </h1>
            <p className="text-[10px] text-gray-400 hidden sm:block">
              {caseData.specialty}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <Timer
            formatted={timer.formatted}
            timerState={timer.timerState}
            isRunning={timer.isRunning}
          />
          <Button
            variant={examMode ? "default" : "outline"}
            size="default"
            onClick={() => setExamMode((v) => !v)}
            disabled={sessionEnded}
            className="h-10 gap-1.5 sm:gap-2 px-2 sm:px-3 font-medium"
            title={
              examMode
                ? "Désactiver le mode examen (afficher l'historique)"
                : "Masquer l'historique pour simuler un oral"
            }
          >
            {examMode ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">Mode examen</span>
            <span className="sm:hidden">Examen</span>
          </Button>
          <Button
            variant="destructive"
            size="default"
            onClick={() => setShowConclusion(true)}
            disabled={sessionEnded}
            className="h-10 px-2.5 sm:px-4 text-sm font-medium"
          >
            Terminer
          </Button>
        </div>
      </header>

      {/* Oral mode — the headline feature, big and central under the header. */}
      <div
        className={`border-b shrink-0 px-3 py-2.5 sm:px-5 sm:py-3 transition-colors ${
          conversationMode
            ? oralModeStatus === "listening"
              ? "bg-gradient-to-r from-red-50 via-rose-50 to-amber-50"
              : "bg-gradient-to-r from-amber-50 via-amber-50 to-teal-50"
            : "bg-gradient-to-r from-teal-50 via-emerald-50 to-teal-50"
        }`}
      >
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <Button
            onClick={() => setConversationMode((v) => !v)}
            disabled={sessionEnded}
            size="lg"
            className={`gap-2 h-11 sm:h-12 px-4 sm:px-6 text-sm sm:text-base font-bold shadow-md transition-all ${
              conversationMode
                ? "bg-red-600 hover:bg-red-700 text-white ring-2 ring-red-300"
                : "bg-teal-600 hover:bg-teal-700 text-white ring-2 ring-teal-300"
            }`}
          >
            {conversationMode ? (
              <MicOff className="h-5 w-5" />
            ) : (
              <Mic className="h-5 w-5" />
            )}
            <span>
              {conversationMode ? (
                "Arrêter l'oral"
              ) : (
                <>
                  <span className="sm:hidden">Parler</span>
                  <span className="hidden sm:inline">🎙 Parler au patient</span>
                </>
              )}
            </span>
          </Button>

          <label className="inline-flex items-center gap-1.5 text-xs text-gray-700">
            <span className="hidden sm:inline font-medium">Vitesse :</span>
            <select
              value={ttsRate}
              onChange={(e) => setTtsRate(Number(e.target.value))}
              className="h-11 sm:h-9 rounded-md border border-gray-300 bg-white px-2 text-sm sm:text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-400"
              title="Vitesse de la voix du patient"
            >
              <option value={1}>1×</option>
              <option value={1.25}>1.25×</option>
              <option value={1.5}>1.5×</option>
              <option value={2}>2×</option>
            </select>
          </label>

          {conversationMode && (
            <>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] sm:text-xs font-semibold ${
                  oralModeStatus === "listening"
                    ? "bg-red-100 text-red-700 animate-pulse"
                    : oralModeStatus === "thinking"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-teal-100 text-teal-700"
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-current" />
                <span className="sm:hidden">
                  {oralModeStatus === "listening"
                    ? "Écoute"
                    : oralModeStatus === "thinking"
                      ? "Réfléchit"
                      : "Répond"}
                </span>
                <span className="hidden sm:inline">
                  {oralModeStatus === "listening"
                    ? "Je vous écoute…"
                    : oralModeStatus === "thinking"
                      ? "Le patient réfléchit…"
                      : "Le patient répond…"}
                </span>
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={manualRestartListening}
                className="h-11 sm:h-9 gap-1.5 ml-auto sm:ml-0"
                title="Si le micro reste bloqué, cliquez pour reprendre l'écoute"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Reprendre l'écoute</span>
                <span className="sm:hidden">Reprendre</span>
              </Button>
            </>
          )}

          {!conversationMode && (
            <p className="hidden sm:block text-xs sm:text-sm text-gray-600 leading-tight">
              Mode oral mains libres — parlez au patient, il vous répond à
              voix haute.
            </p>
          )}
        </div>
      </div>

      {!examMode && <ContextPanel caseData={caseData} autoCollapse={hasStarted} />}

      {caseData.format === "tacfa_patient" && !examMode && (
        <AnnexesPanel
          annexes={(caseData.iconography ?? []).filter((a) =>
            revealedAnnexes.has(a.filename)
          )}
          highlightedFilename={highlightedAnnex}
        />
      )}

      <div className="flex-1 min-h-0">
        <ChatWindow
          messages={messages}
          onSend={sendMessage}
          isLoading={chatLoading}
          disabled={sessionEnded}
          examMode={examMode}
          conversationMode={conversationMode}
          convoListening={convoSpeech.isListening}
        />
      </div>

      <ConclusionDialog
        open={showConclusion}
        onOpenChange={(open) => {
          if (!open && sessionEnded) return;
          setShowConclusion(open);
        }}
        timeUp={sessionEnded}
        remainingFormatted={timer.formatted}
        submitting={evaluating}
        onCancel={() => setShowConclusion(false)}
        onSubmit={submitConclusion}
      />
    </div>
  );
}
