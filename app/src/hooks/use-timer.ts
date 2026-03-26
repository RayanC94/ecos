"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface UseTimerProps {
  initialSeconds: number;
  onTimeUp?: () => void;
}

export function useTimer({ initialSeconds, onTimeUp }: UseTimerProps) {
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds);
  const [isRunning, setIsRunning] = useState(false);
  const onTimeUpRef = useRef(onTimeUp);
  onTimeUpRef.current = onTimeUp;

  useEffect(() => {
    if (!isRunning || secondsLeft <= 0) return;

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setIsRunning(false);
          onTimeUpRef.current?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, secondsLeft]);

  const start = useCallback(() => setIsRunning(true), []);
  const pause = useCallback(() => setIsRunning(false), []);
  const reset = useCallback(() => {
    setSecondsLeft(initialSeconds);
    setIsRunning(false);
  }, [initialSeconds]);

  const elapsed = initialSeconds - secondsLeft;
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const formatted = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  // Timer state for visual feedback
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
