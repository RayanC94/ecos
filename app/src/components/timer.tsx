"use client";

import { cn } from "@/lib/utils";

interface TimerProps {
  formatted: string;
  timerState: "normal" | "warning" | "critical";
  isRunning: boolean;
}

export function Timer({ formatted, timerState, isRunning }: TimerProps) {
  return (
    <div
      className={cn(
        "font-mono text-2xl font-bold px-4 py-2 rounded-lg transition-colors",
        timerState === "normal" && "bg-gray-100 text-gray-900",
        timerState === "warning" && "bg-amber-100 text-amber-800 animate-pulse",
        timerState === "critical" && "bg-red-100 text-red-800 animate-pulse",
        !isRunning && "opacity-60"
      )}
    >
      {formatted}
    </div>
  );
}
