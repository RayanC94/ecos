"use client";

import { useState, useCallback } from "react";
import type { ChatMessage } from "@/types/session";

interface UseChatProps {
  sessionId: string;
}

export function useChat({ sessionId }: UseChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) return;

      const studentMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "student",
        content: content.trim(),
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, studentMessage]);
      setIsLoading(true);

      // Placeholder for patient response
      const patientMessageId = crypto.randomUUID();
      const patientMessage: ChatMessage = {
        id: patientMessageId,
        role: "patient",
        content: "",
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, patientMessage]);

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: sessionId,
            message: content.trim(),
            chat_history: messages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
          }),
        });

        if (!response.ok) throw new Error("Chat request failed");

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let fullText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") continue;

              try {
                const parsed = JSON.parse(data);
                if (parsed.text) {
                  fullText += parsed.text;
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === patientMessageId
                        ? { ...msg, content: fullText }
                        : msg
                    )
                  );
                }
              } catch {
                // Skip malformed chunks
              }
            }
          }
        }
      } catch (error) {
        console.error("Chat error:", error);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === patientMessageId
              ? { ...msg, content: "Désolé, je n'ai pas compris. Pouvez-vous reformuler ?" }
              : msg
          )
        );
      } finally {
        setIsLoading(false);
      }
    },
    [sessionId, messages, isLoading]
  );

  const addSystemMessage = useCallback((content: string) => {
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "patient",
      content,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, msg]);
  }, []);

  return {
    messages,
    isLoading,
    sendMessage,
    addSystemMessage,
  };
}
