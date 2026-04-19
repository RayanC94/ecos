export type ChatRole = "student" | "patient" | "conclusion";

export type ConclusionField = "conclusion";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: number;
  // Only set when role === "conclusion". Single free-text field.
  conclusion_field?: ConclusionField;
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

export interface StudentConclusion {
  conclusion: string;
}
