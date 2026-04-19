export interface TaskScore {
  item_number: number;
  description: string;
  // All-or-nothing: score is either 0 or max_score. No partial credit.
  score: number;
  max_score: number;
  status: "fait" | "non_fait";
  evidence: string; // Quote from transcript
}

export interface CommunicationScore {
  name: string;
  score: number; // 0 to 1
  label: string;
  justification: string;
}

export interface ConclusionScore {
  score: number;
  max_score: number;
  comment: string;
}

export interface EvaluationResult {
  session_id: string;
  case_id: string;
  task_scores: TaskScore[];
  communication_scores: CommunicationScore[];
  conclusion_score: ConclusionScore | null;
  total_score: number;
  max_score: number;
  percentage: number;
  strengths: string[];
  improvements: string[];
  summary: string;
}
