"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface UsePatientTtsReturn {
  isTtsEnabled: boolean;
  isSpeaking: boolean;
  isSupported: boolean;
  toggleTts: () => void;
  setTtsEnabled: (enabled: boolean) => void;
  speakText: (text: string, onEnd?: () => void) => void;
  cancelSpeech: () => void;
}

// Preference order (substring match, case-insensitive) for French voices.
// Cloud / premium voices first — they sound markedly more human than the
// default local ones. `Google français` is Chrome's WaveNet voice;
// Amélie / Thomas / Aurélie are macOS premium voices.
const FRENCH_VOICE_PREFERENCES = [
  "google français",
  "google french",
  "amélie",
  "thomas",
  "aurélie",
  "céline",
  "virginie",
  "daniel",
];

function pickFrenchVoice(
  voices: SpeechSynthesisVoice[]
): SpeechSynthesisVoice | null {
  const fr = voices.filter((v) => v.lang.toLowerCase().startsWith("fr"));
  if (fr.length === 0) return null;
  for (const pref of FRENCH_VOICE_PREFERENCES) {
    const match = fr.find((v) => v.name.toLowerCase().includes(pref));
    if (match) return match;
  }
  const cloud = fr.find((v) => v.localService === false);
  if (cloud) return cloud;
  return fr[0];
}

export function usePatientTts(): UsePatientTtsReturn {
  const [isTtsEnabled, setIsTtsEnabled] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const isTtsEnabledRef = useRef(isTtsEnabled);
  isTtsEnabledRef.current = isTtsEnabled;

  const isSupported =
    typeof window !== "undefined" && "speechSynthesis" in window;

  useEffect(() => {
    if (!isSupported) return;

    const loadVoices = () => {
      voicesRef.current = window.speechSynthesis.getVoices();
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.cancel();
    };
  }, [isSupported]);

  const speakText = useCallback(
    (text: string, onEndCallback?: () => void) => {
      if (!isSupported || !isTtsEnabledRef.current) {
        onEndCallback?.();
        return;
      }
      window.speechSynthesis.cancel();
      setIsSpeaking(true);

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "fr-FR";
      // ~1.5× the previous 0.95 rate — feels naturally brisk rather than slow.
      utterance.rate = 1.4;
      utterance.pitch = 1;

      const frenchVoice = pickFrenchVoice(voicesRef.current);
      if (frenchVoice) utterance.voice = frenchVoice;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => {
        setIsSpeaking(false);
        onEndCallback?.();
      };
      utterance.onerror = () => {
        setIsSpeaking(false);
        onEndCallback?.();
      };

      window.speechSynthesis.speak(utterance);
    },
    [isSupported]
  );

  const cancelSpeech = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, [isSupported]);

  const toggleTts = useCallback(() => {
    setIsTtsEnabled((prev) => {
      if (prev && isSupported) window.speechSynthesis.cancel();
      return !prev;
    });
  }, [isSupported]);

  const setTtsEnabled = useCallback(
    (enabled: boolean) => {
      setIsTtsEnabled((prev) => {
        if (prev === enabled) return prev;
        if (prev && !enabled && isSupported) window.speechSynthesis.cancel();
        return enabled;
      });
    },
    [isSupported]
  );

  return {
    isTtsEnabled,
    isSpeaking,
    isSupported,
    toggleTts,
    setTtsEnabled,
    speakText,
    cancelSpeech,
  };
}
