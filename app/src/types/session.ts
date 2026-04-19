export type ChatRole = "student" | "patient" | "conclusion";

export type ConclusionField = "hypotheses" | "examens" | "prise_en_charge";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: number;
  // Only set when role === "conclusion". Identifies which field of the
  // student's end-of-station conclusion this entry represents.
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
  hypotheses: string;
  examens: string;
  prise_en_charge: string;
}
