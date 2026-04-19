"use client";

import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mic } from "lucide-react";
import { ChatMessage } from "./chat-message";
import { ChatInput } from "./chat-input";
import type { ChatMessage as ChatMessageType } from "@/types/session";

interface ChatWindowProps {
  messages: ChatMessageType[];
  onSend: (message: string) => void;
  isLoading: boolean;
  disabled?: boolean;
  examMode?: boolean;
  conversationMode?: boolean;
  convoListening?: boolean;
}

export function ChatWindow({
  messages,
  onSend,
  isLoading,
  disabled = false,
  examMode = false,
  conversationMode = false,
  convoListening = false,
}: ChatWindowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // In exam mode the student shouldn't be able to reread the transcript:
  // we hide everything except the most recent patient message (and the
  // current streaming response) so the oral feels like a real exam.
  const visibleMessages = (() => {
    if (!examMode) return messages;
    const last = messages[messages.length - 1];
    return last ? [last] : [];
  })();

  return (
    <div className="flex flex-col h-full min-h-0">
      {examMode && (
        <div className="shrink-0 bg-amber-50 border-b border-amber-200 px-3 py-1.5 text-center text-[11px] text-amber-800 font-medium">
          Mode examen actif — l'historique est masqué pour simuler un oral.
        </div>
      )}

      {conversationMode ? (
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 bg-gradient-to-b from-white to-teal-50/30 min-h-0">
          <div
            className={`h-20 w-20 rounded-full flex items-center justify-center mb-4 ${
              convoListening
                ? "bg-red-100 text-red-600 animate-pulse shadow-lg shadow-red-200"
                : isLoading
                  ? "bg-amber-100 text-amber-600 animate-pulse"
                  : "bg-teal-100 text-teal-600"
            }`}
          >
            <Mic className="h-10 w-10" />
          </div>
          <p className="text-sm font-medium text-gray-700 mb-1">
            {convoListening
              ? "À vous la parole — dites votre question"
              : isLoading
                ? "Le patient réfléchit…"
                : "Le patient répond à voix haute"}
          </p>
          <p className="text-xs text-gray-500 text-center max-w-md mb-5">
            Parlez naturellement. À la fin de votre phrase, votre question
            est envoyée et le patient répond oralement.
          </p>
          {!examMode && visibleMessages.length > 0 && (
            <div className="w-full max-w-2xl max-h-[30vh] overflow-auto flex flex-col gap-2 px-1">
              {visibleMessages.slice(-3).map((m) => (
                <ChatMessage key={m.id} message={m} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <ScrollArea
          className="flex-1 px-3 py-2 sm:px-4 sm:py-3"
          viewportRef={scrollRef}
        >
          <div className="flex flex-col gap-3">
            {visibleMessages.length === 0 && (
              <div className="text-center text-gray-400 py-12">
                <p className="text-base">La consultation va commencer...</p>
                <p className="text-sm mt-2">
                  Le patient va se présenter. Posez-lui vos questions.
                </p>
              </div>
            )}
            {visibleMessages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
          </div>
        </ScrollArea>
      )}

      <ChatInput
        onSend={onSend}
        disabled={disabled || isLoading || conversationMode}
        placeholder={
          disabled
            ? "Le temps est écoulé"
            : conversationMode
              ? "Mode conversation — utilisez le micro"
              : isLoading
                ? "Le patient réfléchit..."
                : "Posez votre question..."
        }
      />
    </div>
  );
}
