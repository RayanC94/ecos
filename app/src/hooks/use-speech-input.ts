"use client";

import { useState, useRef, useCallback, useEffect } from "react";

// Minimal SpeechRecognition typings — TypeScript's standard lib doesn't
// ship these, so we declare the shape we actually use.
interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}
interface SpeechRecognitionResult {
  readonly length: number;
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}
interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: Event) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

interface UseSpeechInputOptions {
  continuous?: boolean;
  onEnd?: () => void;
}

interface UseSpeechInputReturn {
  isListening: boolean;
  isSupported: boolean;
  startListening: () => void;
  stopListening: () => void;
}

// Fires `onSegment` each time the engine produces a new final phrase.
// With `continuous: true` the recognition keeps listening through pauses
// until `stopListening()` is called — that's the Mac-dictation-like UX.
export function useSpeechInput(
  onSegment: (transcript: string) => void,
  options: UseSpeechInputOptions = {}
): UseSpeechInputReturn {
  const { continuous = true, onEnd } = options;
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const onSegmentRef = useRef(onSegment);
  const onEndRef = useRef(onEnd);
  onSegmentRef.current = onSegment;
  onEndRef.current = onEnd;

  const isSupported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  useEffect(() => {
    if (!isSupported) return;

    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    const recognition = new Ctor();
    recognition.lang = "fr-FR";
    recognition.continuous = continuous;
    recognition.interimResults = false;

    // Only process new final results since the last event, so continuous
    // listening does not reprocess the entire utterance history on each fire.
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) {
          const t = r[0].transcript.trim();
          if (t) onSegmentRef.current(t);
        }
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      onEndRef.current?.();
    };
    recognition.onerror = () => setIsListening(false);

    recognitionRef.current = recognition;
    return () => {
      recognition.abort();
    };
  }, [isSupported, continuous]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current || isListening) return;
    setIsListening(true);
    try {
      recognitionRef.current.start();
    } catch {
      setIsListening(false);
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current || !isListening) return;
    recognitionRef.current.stop();
  }, [isListening]);

  return { isListening, isSupported, startListening, stopListening };
}

// Heuristic to add a final question mark when the transcript is a
// question but speech recognition returned it without punctuation.
// Only appends `?` — never transforms or capitalizes.
const QUESTION_STARTERS = [
  "est-ce",
  "est ce",
  "avez-vous",
  "avez vous",
  "êtes-vous",
  "êtes vous",
  "etes-vous",
  "etes vous",
  "pouvez-vous",
  "pouvez vous",
  "savez-vous",
  "savez vous",
  "voulez-vous",
  "voulez vous",
  "quand",
  "où",
  "ou est",
  "comment",
  "pourquoi",
  "combien",
  "quel",
  "quelle",
  "quels",
  "quelles",
  "qui",
  "que",
  "quoi",
  "depuis",
  "y a-t-il",
  "y a t il",
  "y a-t",
  "a-t-il",
  "a t il",
  "a-t-elle",
  "a t elle",
];

export function addQuestionMark(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  // Already has terminal punctuation? Keep it.
  if (/[.?!…]$/.test(t)) return t;
  const lower = t.toLowerCase();
  const isQuestion = QUESTION_STARTERS.some((w) =>
    lower.startsWith(w + " ") || lower === w
  );
  return isQuestion ? t + " ?" : t;
}
