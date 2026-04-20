"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mic, MicOff } from "lucide-react";
import { useSpeechInput, addQuestionMark } from "@/hooks/use-speech-input";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({
  onSend,
  disabled = false,
  placeholder = "Posez votre question au patient...",
}: ChatInputProps) {
  const [value, setValue] = useState("");

  // Continuous listening + append: each new final segment is tacked onto the
  // current input so the student can keep dictating across pauses, like
  // Mac Dictation. Toggle the mic button again to stop.
  const { isListening, isSupported, startListening, stopListening } =
    useSpeechInput(
      (segment) =>
        setValue((v) => {
          const base = v ? v.trim() + " " : "";
          return addQuestionMark(base + segment);
        }),
      { continuous: true }
    );

  const handleSubmit = useCallback(() => {
    if (!value.trim() || disabled) return;
    if (isListening) stopListening();
    onSend(value);
    setValue("");
  }, [value, disabled, onSend, isListening, stopListening]);

  return (
    <div
      className="shrink-0 flex gap-2 px-3 py-3 sm:px-4 border-t bg-white"
      style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
    >
      {isSupported && (
        <Button
          type="button"
          variant={isListening ? "destructive" : "outline"}
          size="icon"
          onClick={isListening ? stopListening : startListening}
          disabled={disabled}
          className={`shrink-0 h-11 w-11 sm:h-10 sm:w-10 ${isListening ? "animate-pulse" : ""}`}
          aria-label={isListening ? "Arrêter la dictée" : "Dicter"}
          title={
            isListening
              ? "Cliquez pour arrêter la dictée"
              : "Cliquez pour dicter (continu jusqu'à ce que vous arrêtiez)"
          }
        >
          {isListening ? (
            <MicOff className="h-5 w-5 sm:h-4 sm:w-4" />
          ) : (
            <Mic className="h-5 w-5 sm:h-4 sm:w-4" />
          )}
        </Button>
      )}
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
          }
        }}
        placeholder={isListening ? "Dictée en cours — parlez…" : placeholder}
        disabled={disabled}
        className="flex-1 text-base h-11 sm:h-10"
        autoFocus
      />
      <Button
        onClick={handleSubmit}
        disabled={disabled || !value.trim()}
        size="default"
        className="shrink-0 h-11 sm:h-10"
      >
        Envoyer
      </Button>
    </div>
  );
}
