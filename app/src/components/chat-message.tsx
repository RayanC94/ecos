"use client";

import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { ChatMessage as ChatMessageType } from "@/types/session";

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isPatient = message.role === "patient";

  return (
    <div
      className={cn(
        "flex gap-3 max-w-[85%]",
        isPatient ? "self-start" : "self-end flex-row-reverse"
      )}
    >
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback
          className={cn(
            "text-xs font-medium",
            isPatient
              ? "bg-teal-100 text-teal-700"
              : "bg-blue-100 text-blue-700"
          )}
        >
          {isPatient ? "P" : "E"}
        </AvatarFallback>
      </Avatar>

      <div
        className={cn(
          "rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
          isPatient
            ? "bg-gray-100 text-gray-900 rounded-tl-sm"
            : "bg-blue-600 text-white rounded-tr-sm"
        )}
      >
        {message.content || (
          <span className="inline-flex gap-1">
            <span className="animate-bounce" style={{ animationDelay: "0ms" }}>.</span>
            <span className="animate-bounce" style={{ animationDelay: "150ms" }}>.</span>
            <span className="animate-bounce" style={{ animationDelay: "300ms" }}>.</span>
          </span>
        )}
      </div>
    </div>
  );
}
