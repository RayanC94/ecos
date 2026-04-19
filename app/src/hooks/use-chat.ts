"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { ChatMessage } from "@/types/session";

interface UseChatProps {
  sessionId: string;
  onPatientResponse?: (text: string) => void;
  onStudentMessage?: (text: string) => void;
  storageKey?: string;
}

export function useChat({
  sessionId,
  onPatientResponse,
  onStudentMessage,
  storageKey,
}: UseChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (!storageKey || typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as ChatMessage[];
      if (!Array.isArray(parsed)) return [];
      return parsed;
    } catch {
      return [];
    }
  });
  const [isLoading, setIsLoading] = useState(false);

  // Persist messages so a refresh or a bugged conversation-mode session
  // doesn't wipe the transcript (and the evaluator then receives nothing).
  const storageKeyRef = useRef(storageKey);
  storageKeyRef.current = storageKey;
  useEffect(() => {
    const key = storageKeyRef.current;
    if (!key || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(key, JSON.stringify(messages));
    } catch {
      // ignore quota / disabled storage
    }
  }, [messages]);

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
      onStudentMessage?.(content.trim());

      const patientMessageId = crypto.randomUUID();
      const patientMessage: ChatMessage = {
        id: patientMessageId,
        role: "patient",
        content: "",
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, patientMessage]);

      let fullText = "";

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
        fullText = "Désolé, je n'ai pas compris. Pouvez-vous reformuler ?";
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === patientMessageId ? { ...msg, content: fullText } : msg
          )
        );
      } finally {
        setIsLoading(false);
        // Always fire so the conversation-mode loop (TTS → resume mic) never
        // stalls, even when the API errors out.
        onPatientResponse?.(fullText || "");
      }
    },
    [sessionId, messages, isLoading, onPatientResponse, onStudentMessage]
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
