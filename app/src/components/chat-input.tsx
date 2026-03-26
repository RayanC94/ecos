"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

  const handleSubmit = useCallback(() => {
    if (!value.trim() || disabled) return;
    onSend(value);
    setValue("");
  }, [value, disabled, onSend]);

  return (
    <div className="flex gap-2 p-4 border-t bg-white">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
          }
        }}
        placeholder={placeholder}
        disabled={disabled}
        className="flex-1"
        autoFocus
      />
      <Button
        onClick={handleSubmit}
        disabled={disabled || !value.trim()}
        size="default"
      >
        Envoyer
      </Button>
    </div>
  );
}
