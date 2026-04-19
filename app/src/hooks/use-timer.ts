"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface UseTimerProps {
  initialSeconds: number;
  onTimeUp?: () => void;
  storageKey?: string;
}

type StoredTimer = {
  /** When the timer was last started (ms epoch). */
  startedAt: number;
  /** How many seconds were remaining at `startedAt`. */
  secondsRemainingAt: number;
};

function loadStoredTimer(key: string | undefined): StoredTimer | null {
  if (!key || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredTimer;
    if (
      typeof parsed.startedAt !== "number" ||
      typeof parsed.secondsRemainingAt !== "number"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveStoredTimer(key: string | undefined, s: StoredTimer | null) {
  if (!key || typeof window === "undefined") return;
  try {
    if (s) window.localStorage.setItem(key, JSON.stringify(s));
    else window.localStorage.removeItem(key);
  } catch {
    // ignore quota / disabled storage
  }
}

export function useTimer({ initialSeconds, onTimeUp, storageKey }: UseTimerProps) {
  // On mount, recompute remaining seconds from the stored startedAt anchor
  // so a refresh doesn't rewind the clock.
  const [secondsLeft, setSecondsLeft] = useState<number>(() => {
    const stored = loadStoredTimer(storageKey);
    if (!stored) return initialSeconds;
    const elapsed = Math.floor((Date.now() - stored.startedAt) / 1000);
    return Math.max(0, stored.secondsRemainingAt - elapsed);
  });
  const [isRunning, setIsRunning] = useState<boolean>(() => {
    // Auto-resume if we have a stored anchor and time is left.
    const stored = loadStoredTimer(storageKey);
    if (!stored) return false;
    const elapsed = Math.floor((Date.now() - stored.startedAt) / 1000);
    return stored.secondsRemainingAt - elapsed > 0;
  });
  const onTimeUpRef = useRef(onTimeUp);
  onTimeUpRef.current = onTimeUp;

  // Sync with `initialSeconds` when it changes (e.g. caseData loads
  // async), but only if no persistent anchor exists and the timer has
  // not been started yet.
  useEffect(() => {
    if (loadStoredTimer(storageKey)) return;
    if (isRunning) return;
    setSecondsLeft(initialSeconds);
  }, [initialSeconds, storageKey, isRunning]);

  useEffect(() => {
    if (!isRunning || secondsLeft <= 0) return;

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setIsRunning(false);
          saveStoredTimer(storageKey, null);
          onTimeUpRef.current?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, secondsLeft, storageKey]);

  const start = useCallback(() => {
    setIsRunning(true);
    setSecondsLeft((prev) => {
      // Only (re)anchor storage if there's no valid stored timer already,
      // or if we're starting fresh from the initial value.
      const stored = loadStoredTimer(storageKey);
      const already = stored
        ? Math.max(
            0,
            stored.secondsRemainingAt -
              Math.floor((Date.now() - stored.startedAt) / 1000)
          )
        : 0;
      if (!stored || already <= 0) {
        saveStoredTimer(storageKey, {
          startedAt: Date.now(),
          secondsRemainingAt: prev,
        });
      }
      return prev;
    });
  }, [storageKey]);

  const pause = useCallback(() => {
    setIsRunning(false);
    // Persist the pause point so a refresh picks up here.
    saveStoredTimer(storageKey, {
      startedAt: Date.now(),
      secondsRemainingAt: secondsLeft,
    });
  }, [storageKey, secondsLeft]);

  const reset = useCallback(() => {
    setSecondsLeft(initialSeconds);
    setIsRunning(false);
    saveStoredTimer(storageKey, null);
  }, [initialSeconds, storageKey]);

  const elapsed = initialSeconds - secondsLeft;
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const formatted = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  const timerState: "normal" | "warning" | "critical" =
    secondsLeft <= 30 ? "critical" : secondsLeft <= 120 ? "warning" : "normal";

  return {
    secondsLeft,
    elapsed,
    formatted,
    isRunning,
    timerState,
    start,
    pause,
    reset,
  };
}
