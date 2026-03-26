export interface TaskScore {
  item_number: number;
  description: string;
  score: number; // 0, 0.5, or 1 (normalized)
  max_score: number;
  status: "fait" | "partiel" | "non_fait";
  evidence: string; // Quote from transcript
}

export interface CommunicationScore {
  name: string;
  score: number; // 0 to 1
  label: string;
  justification: string;
}

export interface EvaluationResult {
  session_id: string;
  case_id: string;
  task_scores: TaskScore[];
  communication_scores: CommunicationScore[];
  total_score: number;
  max_score: number;
  percentage: number;
  strengths: string[];
  improvements: string[];
  summary: string;
}
