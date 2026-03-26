export interface ChatMessage {
  id: string;
  role: "student" | "patient";
  content: string;
  timestamp: number;
}

export interface Session {
  id: string;
  case_id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  chat_history: ChatMessage[];
  status: "active" | "completed" | "abandoned";
}
