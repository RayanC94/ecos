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

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "fr-FR";
      utterance.rate = 0.95;

      const frenchVoice = voicesRef.current.find((v) => v.lang.startsWith("fr"));
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
