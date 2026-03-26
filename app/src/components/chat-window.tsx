"use client";

import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatMessage } from "./chat-message";
import { ChatInput } from "./chat-input";
import type { ChatMessage as ChatMessageType } from "@/types/session";

interface ChatWindowProps {
  messages: ChatMessageType[];
  onSend: (message: string) => void;
  isLoading: boolean;
  disabled?: boolean;
}

export function ChatWindow({
  messages,
  onSend,
  isLoading,
  disabled = false,
}: ChatWindowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="flex flex-col gap-4">
          {messages.length === 0 && (
            <div className="text-center text-gray-400 py-12">
              <p className="text-lg">La consultation va commencer...</p>
              <p className="text-sm mt-2">
                Le patient va se présenter. Posez-lui vos questions.
              </p>
            </div>
          )}
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}
        </div>
      </ScrollArea>

      <ChatInput
        onSend={onSend}
        disabled={disabled || isLoading}
        placeholder={
          disabled
            ? "Le temps est écoulé"
            : isLoading
              ? "Le patient réfléchit..."
              : "Posez votre question au patient..."
        }
      />
    </div>
  );
}
